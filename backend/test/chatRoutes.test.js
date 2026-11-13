/**
 * The chat routes against a real SQLite file.
 *
 * Only two things are replaced: the auth middleware (the user comes from a
 * test header) and the AI call. The router, Sequelize and the sqlite3 driver
 * are real, so a query that names a column or an association that does not
 * exist fails here the way it would in the running server.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');

jest.setTimeout(30000);

jest.mock('../middlewares/auth', () => ({
  authMiddleware: (req, res, next) => {
    const userId = req.get('x-test-user');
    if (!userId) return res.status(401).json({ success: false });
    req.user = { userId };
    next();
  }
}));

let dir;
let db;
let app;
let closeConnection;
let chatService;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genex-chat-'));
  process.env.SQLITE_STORAGE = path.join(dir, 'test.sqlite');
  jest.spyOn(console, 'log').mockImplementation(() => {});

  ({ closeConnection } = require('../config/database'));
  db = await require('../models').initializeModels();
  chatService = require('../ai/chatService');

  app = express();
  app.use(express.json());
  app.locals.db = db;
  app.use('/api/chat', require('../routes/chat'));
});

afterAll(async () => {
  await closeConnection();
  delete process.env.SQLITE_STORAGE;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log.mockRestore();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

const newUser = () => db.User.create({ age: 20 });
const as = (user) => ({ 'x-test-user': user.id });

/** A session with messages one second apart, oldest first. */
const seed = async (user, contents, title = 'Seeded') => {
  const session = await db.ChatSession.create({ userId: user.id, title });
  const start = Date.now() - contents.length * 1000;
  for (const [i, content] of contents.entries()) {
    await db.Message.create({
      sessionId: session.id,
      userId: user.id,
      sender: i % 2 === 0 ? 'user' : 'ai',
      content,
      createdAt: new Date(start + i * 1000)
    });
  }
  return session;
};

describe('POST /api/chat/sessions', () => {
  test('creates a session and stores the title', async () => {
    const user = await newUser();
    const res = await request(app).post('/api/chat/sessions').set(as(user)).send({ title: 'Exam week' });

    expect(res.status).toBeLessThan(300);
    const stored = await db.ChatSession.findOne({ where: { userId: user.id } });
    expect(stored.title).toBe('Exam week');
  });

  test('gives a default title when none is sent', async () => {
    const user = await newUser();
    await request(app).post('/api/chat/sessions').set(as(user)).send({});
    const stored = await db.ChatSession.findOne({ where: { userId: user.id } });
    expect(stored.title).toMatch(/^Chat Session /);
  });

  test('rejects a title over 100 characters and creates nothing', async () => {
    const user = await newUser();
    const res = await request(app).post('/api/chat/sessions').set(as(user)).send({ title: 'x'.repeat(101) });
    expect(res.status).toBe(400);
    expect(await db.ChatSession.count({ where: { userId: user.id } })).toBe(0);
  });

  test('refuses a request without a user', async () => {
    expect((await request(app).post('/api/chat/sessions').send({})).status).toBe(401);
  });
});

describe('GET /api/chat/sessions', () => {
  test('lists only the caller\'s sessions, each with its newest message', async () => {
    const [mine, other] = [await newUser(), await newUser()];
    const first = await seed(mine, ['one', 'two', 'three'], 'First');
    const second = await seed(mine, ['alpha', 'beta'], 'Second');
    await seed(other, ['not yours']);

    const res = await request(app).get('/api/chat/sessions').set(as(mine));

    expect(res.status).toBe(200);
    const { sessions, pagination } = res.body.data;
    expect(pagination.totalCount).toBe(2);
    const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
    expect(byId[first.id]).toMatchObject({ title: 'First', lastMessage: { content: 'three' } });
    expect(byId[second.id]).toMatchObject({ title: 'Second', lastMessage: { content: 'beta' } });
    expect(JSON.stringify(res.body)).not.toContain('not yours');
  });

  test('a session with no messages has lastMessage null', async () => {
    const user = await newUser();
    await seed(user, []);
    const res = await request(app).get('/api/chat/sessions').set(as(user));
    expect(res.body.data.sessions[0].lastMessage).toBeNull();
  });

  test('pages the list', async () => {
    const user = await newUser();
    for (const n of [1, 2, 3]) await seed(user, [`m${n}`], `S${n}`);

    const res = await request(app).get('/api/chat/sessions?page=2&limit=2').set(as(user));
    expect(res.body.data.sessions).toHaveLength(1);
    expect(res.body.data.pagination).toMatchObject({
      page: 2, totalPages: 2, totalCount: 3, hasNextPage: false, hasPrevPage: true
    });
  });

  test('rejects a limit over 50', async () => {
    const user = await newUser();
    expect((await request(app).get('/api/chat/sessions?limit=51').set(as(user))).status).toBe(400);
  });
});

describe('GET /api/chat/sessions/:sessionId/messages', () => {
  test('returns the messages oldest first with their content', async () => {
    const user = await newUser();
    const session = await seed(user, ['hi', 'hello', 'how are you']);

    const res = await request(app).get(`/api/chat/sessions/${session.id}/messages`).set(as(user));

    expect(res.status).toBe(200);
    expect(res.body.data.session.title).toBe('Seeded');
    expect(res.body.data.messages.map((m) => m.content)).toEqual(['hi', 'hello', 'how are you']);
    expect(res.body.data.messages.map((m) => m.sender)).toEqual(['user', 'ai', 'user']);
  });

  test('another user\'s session is 404, not their messages', async () => {
    const [owner, other] = [await newUser(), await newUser()];
    const session = await seed(owner, ['private']);
    const res = await request(app).get(`/api/chat/sessions/${session.id}/messages`).set(as(other));
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('private');
  });

  test('an id that is not a UUID is 400', async () => {
    const user = await newUser();
    expect((await request(app).get('/api/chat/sessions/abc/messages').set(as(user))).status).toBe(400);
  });
});

describe('GET /api/chat/export', () => {
  test('exports every session with its messages in order', async () => {
    const [mine, other] = [await newUser(), await newUser()];
    await seed(mine, ['a', 'b', 'c'], 'Export me');
    await seed(other, ['not yours']);

    const res = await request(app).get('/api/chat/export').set(as(mine));

    expect(res.status).toBe(200);
    expect(res.body.data.totalSessions).toBe(1);
    const [session] = res.body.data.sessions;
    expect(session).toMatchObject({ title: 'Export me', messageCount: 3 });
    expect(session.messages.map((m) => m.content)).toEqual(['a', 'b', 'c']);
    expect(JSON.stringify(res.body)).not.toContain('not yours');
  });

  test('a user with nothing gets an empty export', async () => {
    const user = await newUser();
    const res = await request(app).get('/api/chat/export').set(as(user));
    expect(res.body.data).toMatchObject({ totalSessions: 0, sessions: [] });
  });
});

describe('GET /api/chat/stats', () => {
  test('counts the caller\'s sessions and messages only', async () => {
    const [mine, other] = [await newUser(), await newUser()];
    await seed(mine, ['a', 'b']);
    await seed(mine, ['c']);
    await seed(other, ['x', 'y', 'z']);

    const res = await request(app).get('/api/chat/stats').set(as(mine));

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ totalSessions: 2, totalMessages: 3, recentSessions: 2 });
  });
});

describe('DELETE /api/chat/sessions/:sessionId', () => {
  test('deletes the caller\'s session and refuses another user\'s', async () => {
    const [owner, other] = [await newUser(), await newUser()];
    const session = await seed(owner, ['bye']);

    expect((await request(app).delete(`/api/chat/sessions/${session.id}`).set(as(other))).status).toBe(404);
    expect(await db.ChatSession.findByPk(session.id)).not.toBeNull();

    expect((await request(app).delete(`/api/chat/sessions/${session.id}`).set(as(owner))).status).toBe(200);
    expect(await db.ChatSession.findByPk(session.id)).toBeNull();
  });
});

describe('POST /api/chat/message', () => {
  const reply = { content: 'I hear you.', source: 'fallback', crisisDetected: false };

  test('creates a session when none is given and answers', async () => {
    const user = await newUser();
    jest.spyOn(chatService, 'processMessage').mockResolvedValue(reply);

    const res = await request(app).post('/api/chat/message').set(as(user)).send({ message: 'hello there' });

    expect(res.status).toBe(200);
    const session = await db.ChatSession.findByPk(res.body.data.sessionId);
    expect(session.userId).toBe(user.id);
    expect(session.title).toMatch(/^Chat /);
    expect(chatService.processMessage).toHaveBeenCalledWith('hello there', user.id, session.id);
  });

  test('reuses the caller\'s session and moves its last activity forward', async () => {
    const user = await newUser();
    const session = await seed(user, []);
    await session.update({ lastActivity: new Date('2026-01-01T00:00:00Z') });
    jest.spyOn(chatService, 'processMessage').mockResolvedValue(reply);

    const res = await request(app)
      .post('/api/chat/message').set(as(user)).send({ message: 'again', sessionId: session.id });

    expect(res.body.data.sessionId).toBe(session.id);
    const after = await db.ChatSession.findByPk(session.id);
    expect(after.lastActivity.getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00Z').getTime());
  });

  test('does not write into another user\'s session', async () => {
    const [owner, other] = [await newUser(), await newUser()];
    const session = await seed(owner, []);
    jest.spyOn(chatService, 'processMessage').mockResolvedValue(reply);

    const res = await request(app)
      .post('/api/chat/message').set(as(other)).send({ message: 'hi', sessionId: session.id });

    expect(res.body.data.sessionId).not.toBe(session.id);
  });

  test('a failing AI call is a 500 with no detail leaked', async () => {
    const user = await newUser();
    jest.spyOn(chatService, 'processMessage').mockRejectedValue(new Error('upstream key invalid'));

    const res = await request(app).post('/api/chat/message').set(as(user)).send({ message: 'hello' });

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('upstream key invalid');
  });
});

describe('JSON columns are saved, not only changed in memory', () => {
  test('audit log entries reach the database and are capped at 100', async () => {
    const user = await newUser();
    await user.logAuditEvent('user_login', { ipAddress: '203.0.113.9' });
    await user.logAuditEvent('user_logout');

    let stored = await db.User.findByPk(user.id);
    expect(stored.auditLog.map((e) => e.action)).toEqual(['user_login', 'user_logout']);
    expect(stored.auditLog[0].ipAddress).toBe('203.0.113.9');

    stored.auditLog = Array.from({ length: 100 }, (_, i) => ({ action: `old_${i}` }));
    await stored.save();
    await stored.logAuditEvent('newest');
    stored = await db.User.findByPk(user.id);
    expect(stored.auditLog).toHaveLength(100);
    expect(stored.auditLog[0].action).toBe('old_1');
    expect(stored.auditLog[99].action).toBe('newest');
  });

  test('a crisis event on a session reaches the database', async () => {
    const user = await newUser();
    const session = await seed(user, []);

    await session.addMessage({ crisis_detected: false });
    await session.addMessage({ crisis_detected: true, crisis_severity: 'high', id: 'm1' });

    const stored = await db.ChatSession.findByPk(session.id);
    expect(stored.messageCount).toBe(2);
    expect(stored.crisisEvents).toHaveLength(1);
    expect(stored.crisisEvents[0]).toMatchObject({ severity: 'high', message_id: 'm1' });
  });

  test('sentiment history reaches the database and keeps the last 50', async () => {
    const user = await newUser();
    const session = await seed(user, []);

    for (let i = 0; i < 52; i++) {
      await session.updateSessionStats({ sentiment: 'negative', sentiment_score: i });
    }
    await session.updateSessionStats({});

    const stored = await db.ChatSession.findByPk(session.id);
    expect(stored.aiMetadata.sentimentHistory).toHaveLength(50);
    expect(stored.aiMetadata.sentimentHistory[0].score).toBe(2);
    expect(stored.aiMetadata.crisis_detection).toBe(true);
  });
});

describe('a database made before the title column', () => {
  test('gets the column added once, and existing sessions are kept', async () => {
    const { addTitleColumn } = require('../models');
    const table = db.ChatSession.getTableName();
    const queryInterface = db.sequelize.getQueryInterface();
    const user = await newUser();
    const session = await seed(user, []);

    await queryInterface.removeColumn(table, 'title');
    await db.sequelize.sync({ force: false });
    expect(await queryInterface.describeTable(table)).not.toHaveProperty('title');

    expect(await addTitleColumn(db.sequelize, db.ChatSession)).toBe(true);
    expect(await queryInterface.describeTable(table)).toHaveProperty('title');
    expect(await addTitleColumn(db.sequelize, db.ChatSession)).toBe(false);

    const res = await request(app).get(`/api/chat/sessions/${session.id}/messages`).set(as(user));
    expect(res.status).toBe(200);
    expect(res.body.data.session).toMatchObject({ id: session.id, title: null });
  });
});
