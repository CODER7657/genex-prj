/**
 * Starts the real server in a child process and talks to it over HTTP.
 *
 * server.js starts listening as soon as it is loaded, so it cannot be required
 * inside jest. This is the only test that proves the file still loads: every
 * require resolves, the models sync, and the routes are mounted where the
 * frontend expects them.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

jest.setTimeout(60000);

let child;
let dir;
let base;
let output = '';

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const waitUntilUp = async (url, deadline) => {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited with code ${child.exitCode}:\n${output.slice(-2000)}`);
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`server did not answer in time:\n${output.slice(-2000)}`);
};

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genex-server-'));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      SQLITE_STORAGE: path.join(dir, 'smoke.sqlite'),
      JWT_SECRET: 'smoke-test-jwt-secret-not-used-anywhere-else',
      SESSION_SECRET: 'smoke-test-session-secret-not-used-anywhere-else',
      FORCE_REDIS: 'false',
      LOG_LEVEL: 'error'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  await waitUntilUp(`${base}/health`, Date.now() + 45000);
});

afterAll(async () => {
  if (child && child.exitCode === null) {
    const gone = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await gone;
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

const get = (route, headers) => fetch(base + route, { headers, signal: AbortSignal.timeout(10000) });

test('the server starts and reports its health', async () => {
  const res = await get('/health');
  expect(res.status).toBeLessThan(500);
  expect(output).not.toMatch(/Cannot find module/);
});

test('chat routes are mounted and refuse a request without a token', async () => {
  for (const route of ['/api/chat/sessions', '/api/chat/stats', '/api/chat/export']) {
    const res = await get(route);
    expect([401, 403]).toContain(res.status);
  }
});

test('a made-up token is refused, not accepted', async () => {
  const res = await get('/api/chat/sessions', { Authorization: 'Bearer not-a-real-token' });
  expect([401, 403]).toContain(res.status);
});

test('the removed MongoDB routes are gone, with or without a token', async () => {
  for (const route of ['/api/users/profile', '/api/assessments/history', '/api/assessments/forms']) {
    expect((await get(route)).status).toBe(404);
    expect((await get(route, { Authorization: 'Bearer not-a-real-token' })).status).toBe(404);
  }
});

test('registration validates its input over real HTTP', async () => {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ age: 'not-a-number' }),
    signal: AbortSignal.timeout(10000)
  });
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
});
