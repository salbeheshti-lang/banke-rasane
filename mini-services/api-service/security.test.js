import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { afterAll, beforeAll, test } from 'bun:test';

const initialPassword = 'ci-only-not-for-production';
let tempDir;
let dbPath;
let baseUrl;
let apiProcess;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function reservePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve test port');
  const port = address.port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function apiRequest(path, { method = 'GET', token, body, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function login(username, password) {
  const response = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  return { response, data: await response.json() };
}

async function loginAdmin() {
  const { response, data } = await login('admin', initialPassword);
  assert.equal(response.status, 200);
  assert.ok(data.token);
  return data.token;
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'banke-rasane-api-test-'));
  copyFileSync(join(import.meta.dir, 'index.js'), join(tempDir, 'index.js'));
  dbPath = join(tempDir, 'bankresaneh.sqlite');
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;

  apiProcess = spawn(process.execPath, ['run', 'index.js'], {
    cwd: tempDir,
    env: {
      ...process.env,
      PORT: String(port),
      ADMIN_INITIAL_PASSWORD: initialPassword,
      BANKRESANE_ALLOWED_ORIGINS: 'http://localhost:3000',
    },
    stdio: 'ignore',
  });

  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`Local API exited early with code ${apiProcess.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await sleep(100);
  }
  assert.equal(ready, true, 'Local API should start and respond to /api/health');
});

afterAll(async () => {
  if (apiProcess && apiProcess.exitCode === null) {
    const exited = once(apiProcess, 'exit');
    apiProcess.kill('SIGTERM');
    await Promise.race([exited, sleep(1500)]);
  }
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

test('local API returns no-store headers and allows only configured CORS origins', async () => {
  const health = await apiRequest('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('Cache-Control'), 'no-store');

  const denied = await apiRequest('/api/health', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(denied.status, 204);
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);

  const allowed = await apiRequest('/api/health', {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:3000' },
  });
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000');
});

test('local API rejects malformed login JSON with 400', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-json',
  });
  assert.equal(response.status, 400);
});

test('local API rate-limits repeated failed logins', async () => {
  const username = `missing-${Date.now()}`;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { response } = await login(username, 'wrong-password');
    assert.equal(response.status, 401);
  }
  const { response } = await login(username, 'wrong-password');
  assert.equal(response.status, 429);
});

test('admin login works without changing the configured password and protected routes require auth', async () => {
  const anonymous = await apiRequest('/api/users');
  assert.equal(anonymous.status, 401);

  const token = await loginAdmin();
  const me = await apiRequest('/api/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).username, 'admin');

  const users = await apiRequest('/api/users', { token });
  assert.equal(users.status, 200);
});

test('viewer cannot access admin-only user management or write show records', async () => {
  const adminToken = await loginAdmin();
  const create = await apiRequest('/api/users', {
    method: 'POST',
    token: adminToken,
    body: { username: 'ci-viewer', password: 'viewer-pass-123', role: 'viewer', name: 'CI Viewer' },
  });
  assert.equal(create.status, 200);

  const { response, data } = await login('ci-viewer', 'viewer-pass-123');
  assert.equal(response.status, 200);

  const users = await apiRequest('/api/users', { token: data.token });
  assert.equal(users.status, 403);

  const createShow = await apiRequest('/api/shows', {
    method: 'POST',
    token: data.token,
    body: { num: 9999, name: 'Should not be created' },
  });
  assert.equal(createShow.status, 403);
});

test('successful legacy-password login upgrades only the stored hash', async () => {
  const db = new Database(dbPath);
  const legacyHash = createHash('sha256').update(initialPassword, 'utf8').digest('hex');
  db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(legacyHash, 'admin');
  db.close();

  const { response, data } = await login('admin', initialPassword);
  assert.equal(response.status, 200);
  assert.ok(data.token);

  const verifyDb = new Database(dbPath);
  const row = verifyDb.prepare('SELECT password_hash FROM users WHERE username = ?').get('admin');
  verifyDb.close();
  assert.ok(row.password_hash.startsWith('scrypt$'));
});

test('local API rejects expired sessions', async () => {
  const token = await loginAdmin();
  const db = new Database(dbPath);
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
    .run(Math.floor(Date.now() / 1000) - 1, token);
  db.close();

  const response = await apiRequest('/api/auth/me', { token });
  assert.equal(response.status, 401);
});
