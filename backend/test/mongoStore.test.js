/**
 * The profile and assessment routes need a MongoDB connection that this
 * server never opens. They must answer at once, not hang.
 */

const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');

const { requireMongo } = require('../middlewares/mongoStore');
const Message = require('../models/Message');

const appWith = (router) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { userId: '11111111-1111-4111-8111-111111111111' };
    next();
  });
  app.use('/api', requireMongo, router);
  return app;
};

// An own property hides the getter on the connection's prototype; deleting it
// brings the real state back.
const setReadyState = (state) =>
  Object.defineProperty(mongoose.connection, 'readyState', { value: state, configurable: true });

afterEach(() => {
  delete mongoose.connection.readyState;
});

describe('requireMongo', () => {
  test.each([
    ['disconnected', 0],
    ['connecting', 2],
    ['disconnecting', 3]
  ])('answers 503 while mongoose is %s', async (_name, state) => {
    setReadyState(state);
    const reached = jest.fn((req, res) => res.json({ ok: true }));

    const res = await request(appWith(reached)).get('/api/anything');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      code: 'FEATURE_UNAVAILABLE',
      message: 'This feature is not available on this server.'
    });
    expect(reached).not.toHaveBeenCalled();
  });

  test('lets the request through once mongoose is connected', async () => {
    setReadyState(1);
    const res = await request(appWith((req, res) => res.json({ ok: true }))).get('/api/anything');
    expect(res.status).toBe(200);
  });

  test.each([
    ['get', '/profile', '../routes/user'],
    ['post', '/crisis-event', '../routes/user'],
    ['delete', '/account', '../routes/user'],
    ['post', '/mood', '../routes/assessment'],
    ['get', '/history', '../routes/assessment']
  ])('%s %s answers within a second instead of waiting for mongoose', async (method, path, routes) => {
    const started = Date.now();
    const res = await request(appWith(require(routes)))[method](`/api${path}`).send({});

    expect(res.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('Message.messageId', () => {
  const fields = () => ({
    sessionId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    sender: 'user',
    content: 'hello'
  });

  test('is generated when it is not given, and the message validates', async () => {
    const message = new Message(fields());
    expect(message.messageId).toMatch(/^msg_[0-9a-f-]{36}$/);
    await expect(message.validate()).resolves.toBeUndefined();
  });

  test('does not repeat', () => {
    const ids = new Set(Array.from({ length: 500 }, () => new Message(fields()).messageId));
    expect(ids.size).toBe(500);
  });

  test('keeps an id that was given', () => {
    expect(new Message({ ...fields(), messageId: 'msg_given' }).messageId).toBe('msg_given');
  });
});
