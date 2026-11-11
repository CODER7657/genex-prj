/**
 * Request sanitiser: no MongoDB operator reaches a query.
 *
 * Every route reads `req.body` after `sanitizeRequest` has run (server.js), so a
 * login body such as {"email": {"$ne": null}} must arrive as {"email": {}} and
 * match no user. CodeQL cannot see that link and reports the queries in
 * routes/auth.js and routes/user.js; these tests are the evidence that the
 * operators are gone before those lines run.
 */
const { sanitizeObject, sanitizeRequest } = require('../middlewares/security');

describe('sanitizeObject', () => {
  test('removes an operator used to match any user', () => {
    expect(sanitizeObject({ email: { $ne: null }, password: 'x' })).toEqual({ email: {}, password: 'x' });
  });

  test('removes operators at any depth, inside arrays too', () => {
    const body = { a: { b: { $gt: '' } }, list: [{ $where: 'sleep(1000)' }, { ok: 1 }] };
    expect(sanitizeObject(body)).toEqual({ a: { b: {} }, list: [{}, { ok: 1 }] });
  });

  test('removes dotted keys, which would reach into another field on update', () => {
    expect(sanitizeObject({ 'preferences.theme': 'dark', 'role.admin': true, theme: 'dark' })).toEqual({ theme: 'dark' });
  });

  test('removes update operators from a profile update', () => {
    expect(sanitizeObject({ preferences: { $set: { isAdmin: true }, theme: 'dark' } })).toEqual({
      preferences: { theme: 'dark' },
    });
  });

  test('leaves ordinary values alone, including a dollar sign inside a string', () => {
    const body = { email: 'a@b.co', note: 'costs $5.00', n: 0, flag: false, nothing: null, list: [1, 'two'] };
    expect(sanitizeObject(body)).toEqual(body);
  });

  test('passes through values that are not objects', () => {
    expect(sanitizeObject('text')).toBe('text');
    expect(sanitizeObject(7)).toBe(7);
    expect(sanitizeObject(null)).toBeNull();
    expect(sanitizeObject(undefined)).toBeUndefined();
  });

  test('does not change the object it was given', () => {
    const body = { email: { $ne: null } };
    sanitizeObject(body);
    expect(body).toEqual({ email: { $ne: null } });
  });
});

describe('sanitizeRequest', () => {
  const run = (req) => {
    const res = { set: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    Object.assign(req, { method: 'POST', path: '/api/auth/login', ip: '127.0.0.1' });
    sanitizeRequest(req, res, next);
    return { res, next };
  };

  test('cleans the body and the query before the route runs', () => {
    const req = { body: { email: { $ne: null } }, query: { 'a.b': '1', page: '2' } };
    const { next } = run(req);
    expect(req.body).toEqual({ email: {} });
    expect(req.query).toEqual({ page: '2' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('gives every request an id and returns it in a header', () => {
    const req = { body: {} };
    const { res } = run(req);
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.set).toHaveBeenCalledWith('X-Request-ID', req.requestId);
  });

  test('continues when there is no body or query', () => {
    const { next, res } = run({});
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
