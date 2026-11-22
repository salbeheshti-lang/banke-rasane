import { Database } from 'bun:sqlite';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dir, '..');
const apiEntry = path.join(root, 'mini-services', 'api-service', 'index.js');
const tempDir = mkdtempSync(path.join(tmpdir(), 'bankresaneh-rate-limit-'));
const dbPath = path.join(tempDir, 'api.sqlite');
const seedPath = path.join(tempDir, 'empty-seed.json');
const startupToken = crypto.randomBytes(32).toString('hex');
writeFileSync(seedPath, '[]', 'utf8');

let child;
let output = '';
let port;
const base = () => 'http://127.0.0.1:' + port;

function assert(condition, message) {
  if (!condition) throw new Error('FAIL ' + message);
  console.log('PASS ' + message);
}

async function getPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}

function startApi() {
  child = spawn('bun', [apiEntry], {
    cwd: path.dirname(apiEntry),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      BANKRESANEH_HOST: '127.0.0.1',
      BANKRESANEH_SEED_PATH: seedPath,
      BANKRESANEH_STARTUP_TOKEN: startupToken,
      DB_PATH: dbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
}

async function waitForApi() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('API exited early: ' + output);
    try {
      const response = await fetch(base() + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('API did not start: ' + output);
}

async function call(route, { method = 'GET', token, body } = {}) {
  const response = await fetch(base() + route, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, data: await response.json().catch(() => ({})), retryAfter: response.headers.get('Retry-After') };
}

async function main() {
  port = await getPort();
  startApi();
  await waitForApi();

  const first = await call('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'admin' } });
  assert(first.status === 200 && first.data.user?.mustChangePassword, 'fresh admin can authenticate before forced password change');
  const changed = await call('/api/auth/change-password', {
    method: 'PUT',
    token: first.data.token,
    body: { oldPassword: 'admin', newPassword: 'RateLimitAdmin!2026' },
  });
  assert(changed.status === 200 && !!changed.data.token, 'admin password change succeeds');
  const adminToken = changed.data.token;
  const adminId = Number(changed.data.user?.id || first.data.user.id);

  // 20 parallel calls must produce exactly 10 successes and 10 rejections.
  const parallel = await Promise.all(Array.from({ length: 20 }, () =>
    call('/api/rate-limit/translate', { method: 'POST', token: adminToken })
  ));
  const allowed = parallel.filter(result => result.status === 200).length;
  const rejected = parallel.filter(result => result.status === 429).length;
  assert(allowed === 10 && rejected === 10, 'atomic per-user limiter allows exactly 10 of 20 concurrent requests');
  assert(parallel.filter(result => result.status === 429).every(result => Number(result.retryAfter) > 0), 'rate-limit responses include Retry-After');

  // The same token and bucket must survive an API process restart.
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  startApi();
  await waitForApi();
  const persisted = await call('/api/rate-limit/translate', { method: 'POST', token: adminToken });
  assert(persisted.status === 429, 'rate-limit bucket and session persist across API restart');

  // A different editor account receives an independent quota.
  const created = await call('/api/users', {
    method: 'POST',
    token: adminToken,
    body: { username: 'rate_editor', password: 'RateEditor!2026', role: 'editor', name: 'Rate Editor' },
  });
  assert(created.status === 200, 'admin can create an editor for per-user quota test');
  const editorLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { username: 'rate_editor', password: 'RateEditor!2026' },
  });
  assert(editorLogin.status === 200, 'editor can log in');
  const editorResults = await Promise.all(Array.from({ length: 12 }, () =>
    call('/api/rate-limit/translate', { method: 'POST', token: editorLogin.data.token })
  ));
  assert(editorResults.filter(result => result.status === 200).length === 10 &&
    editorResults.filter(result => result.status === 429).length === 2,
    'each account receives an independent 10-request quota');

  // Reset the admin window directly in SQLite, then verify the next call is allowed.
  const db = new Database(dbPath);
  db.prepare('UPDATE translation_rate_buckets SET reset_at = ? WHERE user_id = ?').run(Math.floor(Date.now() / 1000) - 1, adminId);
  db.close();
  const reset = await call('/api/rate-limit/translate', { method: 'POST', token: adminToken });
  assert(reset.status === 200, 'expired translation window resets and allows a new request');

  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  console.log('ALL RATE LIMIT TESTS PASS');
}

main().catch(error => {
  console.error(error);
  console.error(output);
  process.exitCode = 1;
}).finally(() => {
  try { if (child && child.exitCode === null) child.kill('SIGTERM'); } catch {}
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
});
