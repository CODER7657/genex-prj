/**
 * Session store and cache in config/redis.js.
 *
 * Three situations are covered:
 *   1. Redis switched off: memory session store and memory cache.
 *   2. Redis switched on but unreachable: falls back to memory, no client left running.
 *   3. A real Redis server: runs only when REDIS_TEST_URL is set (CI starts a
 *      redis service for this). Sessions go through connect-redis and node-redis
 *      with nothing mocked.
 */

const ENV_KEYS = [
  'NODE_ENV', 'FORCE_REDIS', 'LOG_LEVEL', 'SESSION_SECRET',
  'REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD', 'REDIS_DB', 'REDIS_TLS'
];
const saved = {};

const load = (env) => {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: 'test', LOG_LEVEL: 'silent', ...env });
  jest.resetModules();
  return require('../config/redis');
};

beforeAll(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('redisOptions', () => {
  const { redisOptions } = load({});

  test('defaults to localhost:6379, database 0, no password, no TLS', () => {
    expect(redisOptions({})).toEqual({
      socket: { connectTimeout: 5000, host: 'localhost', port: 6379 },
      database: 0
    });
  });

  test('reads host, port, password and database in the shape node-redis expects', () => {
    const options = redisOptions({
      REDIS_HOST: 'cache.internal',
      REDIS_PORT: '6380',
      REDIS_PASSWORD: 'not-a-real-password',
      REDIS_DB: '2'
    });
    expect(options).toEqual({
      socket: { connectTimeout: 5000, host: 'cache.internal', port: 6380 },
      database: 2,
      password: 'not-a-real-password'
    });
    // The old ioredis-style top-level keys were silently ignored by node-redis.
    expect(options).not.toHaveProperty('host');
    expect(options).not.toHaveProperty('port');
    expect(options).not.toHaveProperty('db');
  });

  test('REDIS_URL wins over host and port', () => {
    expect(redisOptions({ REDIS_URL: 'redis://example.test:7000/1', REDIS_HOST: 'ignored' })).toEqual({
      url: 'redis://example.test:7000/1',
      socket: { connectTimeout: 5000 }
    });
  });

  test('TLS is off unless REDIS_TLS is exactly "true", and never disables verification', () => {
    expect(redisOptions({ REDIS_TLS: 'true' }).socket.tls).toBe(true);
    expect(redisOptions({ REDIS_TLS: 'true', REDIS_URL: 'rediss://example.test' }).socket.tls).toBe(true);
    for (const value of ['1', 'yes', 'TRUE', '']) {
      expect(redisOptions({ REDIS_TLS: value }).socket).not.toHaveProperty('tls');
    }
    expect(redisOptions({ REDIS_TLS: 'true' }).socket).not.toHaveProperty('rejectUnauthorized');
  });

  test.each(['abc', '0', '70000', '63.5', '-1'])('rejects REDIS_PORT=%s', (port) => {
    expect(() => redisOptions({ REDIS_PORT: port })).toThrow('REDIS_PORT');
  });

  test.each(['x', '-1', '1.5'])('rejects REDIS_DB=%s', (db) => {
    expect(() => redisOptions({ REDIS_DB: db })).toThrow('REDIS_DB');
  });
});

describe('with Redis switched off', () => {
  let redis;

  beforeEach(() => {
    jest.useFakeTimers();
    redis = load({});
  });

  afterEach(async () => {
    await redis.closeConnection();
    jest.useRealTimers();
  });

  test('initRedis connects to nothing and the session uses the default memory store', async () => {
    expect(await redis.initRedis()).toBeNull();
    expect(redis.isRedisAvailable()).toBe(false);
    expect(redis.getClient()).toBeUndefined();

    const config = redis.createSessionConfig();
    expect(config.store).toBeUndefined();
    expect(config.cookie).toMatchObject({ httpOnly: true, sameSite: 'strict', secure: false });
  });

  test('session ids are 64 hex characters and do not repeat', () => {
    const { genid } = redis.createSessionConfig();
    const ids = new Set(Array.from({ length: 200 }, () => genid()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  test('the memory cache stores, reads, deletes and expires', async () => {
    await redis.cache.set('k', { a: 1 }, 60);
    expect(await redis.cache.get('k')).toEqual({ a: 1 });
    expect(await redis.cache.exists('k')).toBe(true);

    jest.advanceTimersByTime(61 * 1000);
    expect(await redis.cache.get('k')).toBeNull();
    expect(await redis.cache.exists('k')).toBeFalsy();

    await redis.cache.set('gone', 1, 60);
    await redis.cache.del('gone');
    expect(await redis.cache.get('gone')).toBeNull();
    expect(await redis.cache.get('never-set')).toBeNull();
  });

  test('expire moves the deadline of an existing key only', async () => {
    await redis.cache.set('k', 'v', 10);
    await redis.cache.expire('k', 100);
    jest.advanceTimersByTime(50 * 1000);
    expect(await redis.cache.get('k')).toBe('v');

    await redis.cache.expire('missing', 100);
    expect(await redis.cache.get('missing')).toBeNull();
  });

  test('health check reports the memory fallback', async () => {
    expect(await redis.healthCheck()).toMatchObject({
      status: 'healthy',
      type: 'memory_fallback',
      connected: false
    });
  });
});

describe('with Redis switched on but unreachable', () => {
  jest.setTimeout(20000);

  test('falls back to the memory store and leaves no client retrying', async () => {
    // Port 1 on localhost refuses connections.
    const redis = load({ FORCE_REDIS: 'true', REDIS_HOST: '127.0.0.1', REDIS_PORT: '1' });

    expect(await redis.initRedis()).toBeNull();
    expect(redis.isRedisAvailable()).toBe(false);
    expect(redis.getClient()).toBeNull();
    expect(redis.createSessionConfig().store).toBeUndefined();

    await redis.cache.set('k', 'v', 1);
    expect(await redis.cache.get('k')).toBe('v');
    await redis.closeConnection();
  });

  test('a bad REDIS_PORT also falls back instead of crashing the server', async () => {
    const redis = load({ FORCE_REDIS: 'true', REDIS_PORT: 'not-a-port' });
    expect(await redis.initRedis()).toBeNull();
    expect(redis.createSessionConfig().store).toBeUndefined();
    await redis.closeConnection();
  });
});

const realRedis = process.env.REDIS_TEST_URL;
const describeReal = realRedis ? describe : describe.skip;

describeReal('with a real Redis server', () => {
  jest.setTimeout(20000);
  let redis;
  let store;

  const call = (method, ...args) =>
    new Promise((resolve, reject) => {
      store[method](...args, (err, value) => (err ? reject(err) : resolve(value)));
    });

  beforeAll(async () => {
    redis = load({ FORCE_REDIS: 'true', REDIS_URL: realRedis });
    expect(await redis.initRedis()).not.toBeNull();
    store = redis.createSessionConfig().store;
  });

  afterAll(async () => {
    await redis.closeConnection();
  });

  test('the session store is a connect-redis RedisStore', () => {
    const { RedisStore } = require('connect-redis');
    expect(redis.isRedisAvailable()).toBe(true);
    expect(store).toBeInstanceOf(RedisStore);
  });

  test('a session is written with a TTL, read back and destroyed', async () => {
    const sid = `test-${Date.now()}`;
    const session = { cookie: { maxAge: 60000 }, userId: 'u1' };

    await call('set', sid, session);
    expect(await call('get', sid)).toEqual(session);

    const ttl = await redis.getClient().ttl(`mental_wellness_session:${sid}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);

    await call('destroy', sid);
    expect(await call('get', sid)).toBeNull();
  });

  test('reading a session that was never written gives null, not an error', async () => {
    expect(await call('get', 'no-such-session')).toBeNull();
  });

  test('the cache stores, reads and deletes through Redis', async () => {
    const key = `test-cache-${Date.now()}`;
    await redis.cache.set(key, { n: 1 }, 30);
    expect(await redis.cache.get(key)).toEqual({ n: 1 });
    expect(await redis.cache.exists(key)).toBe(true);
    await redis.cache.del(key);
    expect(await redis.cache.get(key)).toBeNull();
  });

  test('health check reports Redis', async () => {
    expect(await redis.healthCheck()).toMatchObject({
      status: 'healthy',
      type: 'redis',
      connected: true
    });
  });
});
