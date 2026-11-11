/**
 * The Sequelize models against a real SQLite file.
 *
 * Nothing is mocked: the sqlite3 driver opens a throwaway database in the
 * system temp folder, the schema is synced, and rows are written and read back.
 * This is the check that a sqlite3 driver upgrade still works with Sequelize.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.setTimeout(30000);

let dir;
let db;
let closeConnection;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genex-sqlite-'));
  process.env.SQLITE_STORAGE = path.join(dir, 'test.sqlite');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  ({ closeConnection } = require('../config/database'));
  db = await require('../models').initializeModels();
});

afterAll(async () => {
  await closeConnection();
  delete process.env.SQLITE_STORAGE;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log.mockRestore();
});

const newUser = (over = {}) => db.User.create({ age: 20, ...over });

describe('sqlite driver', () => {
  test('opens the file named by SQLITE_STORAGE', async () => {
    expect(db.sequelize.getDialect()).toBe('sqlite');
    expect(fs.existsSync(process.env.SQLITE_STORAGE)).toBe(true);
    const [rows] = await db.sequelize.query('select sqlite_version() as v');
    expect(rows[0].v).toMatch(/^3\.\d+/);
  });

  test('creates the three tables', async () => {
    const tables = await db.sequelize.getQueryInterface().showAllTables();
    for (const model of [db.User, db.ChatSession, db.Message]) {
      expect(tables).toContain(model.getTableName());
    }
  });
});

describe('User', () => {
  test('stores a hashed password and a lower-cased email', async () => {
    await newUser({ email: 'Mixed.Case@Example.com', password: 'correct horse' });
    const found = await db.User.scope('withPassword').findOne({
      where: { email: 'mixed.case@example.com' }
    });
    expect(found).not.toBeNull();
    expect(found.password).not.toBe('correct horse');
    expect(await found.comparePassword('correct horse')).toBe(true);
    expect(await found.comparePassword('wrong horse')).toBe(false);
  });

  test('leaves the password out of a default read', async () => {
    await newUser({ email: 'hidden@example.com', password: 'correct horse' });
    const found = await db.User.findByEmail('HIDDEN@example.com');
    expect(found.password).toBeUndefined();
  });

  test('round-trips JSON columns', async () => {
    const user = await newUser({ emergencyContact: { name: 'A', phone: '100' } });
    user.preferences = { ...user.preferences, language: 'gu' };
    await user.save();
    const again = await db.User.findByPk(user.id);
    expect(again.emergencyContact).toEqual({ name: 'A', phone: '100' });
    expect(again.preferences.language).toBe('gu');
    expect(again.auditLog).toEqual([]);
  });

  test('rejects a second user with the same email', async () => {
    await newUser({ email: 'twice@example.com' });
    await expect(newUser({ email: 'twice@example.com' })).rejects.toMatchObject({
      name: 'SequelizeUniqueConstraintError'
    });
    expect(await db.User.isEmailTaken('TWICE@example.com')).toBe(true);
    expect(await db.User.isEmailTaken('nobody@example.com')).toBe(false);
  });

  test('rejects a row without the required age', async () => {
    await expect(db.User.create({})).rejects.toMatchObject({
      name: 'SequelizeValidationError'
    });
  });

  test('locks the account after five failed logins', async () => {
    const user = await newUser();
    for (let i = 0; i < 5; i++) await user.updateLoginAttempt(false);
    const again = await db.User.findByPk(user.id);
    expect(again.loginAttempts).toBe(5);
    expect(again.isAccountLocked()).toBe(true);
  });

  test('a deleted user is hidden from reads but kept in the table', async () => {
    const user = await newUser();
    await user.destroy();
    expect(await db.User.findByPk(user.id)).toBeNull();
    expect(await db.User.findByPk(user.id, { paranoid: false })).not.toBeNull();
  });
});

describe('ChatSession and Message', () => {
  test('counts sessions and messages for one user only', async () => {
    const [mine, other] = [await newUser(), await newUser()];
    const session = await db.ChatSession.create({ userId: mine.id });
    await db.ChatSession.create({ userId: other.id });
    for (const sender of ['user', 'ai', 'user']) {
      await db.Message.create({
        sessionId: session.id,
        userId: mine.id,
        sender,
        content: 'hello'
      });
    }

    expect(await db.ChatSession.count({ where: { userId: mine.id } })).toBe(1);
    const messages = await db.Message.count({
      include: [{ model: db.ChatSession, as: 'session', where: { userId: mine.id }, attributes: [] }]
    });
    expect(messages).toBe(3);
    expect(await db.Message.count({ where: { userId: other.id } })).toBe(0);
  });

  test('rejects a message without content', async () => {
    const user = await newUser();
    const session = await db.ChatSession.create({ userId: user.id });
    await expect(
      db.Message.create({ sessionId: session.id, userId: user.id, sender: 'user' })
    ).rejects.toMatchObject({ name: 'SequelizeValidationError' });
  });

  test('rejects a session for a user that does not exist', async () => {
    await expect(
      db.ChatSession.create({ userId: '00000000-0000-4000-8000-000000000000' })
    ).rejects.toMatchObject({ name: 'SequelizeForeignKeyConstraintError' });
  });
});
