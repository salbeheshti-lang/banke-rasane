/* eslint @typescript-eslint/no-require-imports: off */
// End-to-end smoke test for the Bun API. Uses an isolated temporary SQLite DB.
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { createServer } = require('node:net');
const assert = require('node:assert/strict');

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

async function waitForApi(base, child, logs) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('API exited early: ' + child.exitCode);
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1500) });
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error('API readiness timeout. Output:\n' + logs.join('').slice(-6000));
}

async function main() {
  const port = await freePort();
  const tempDir = mkdtempSync(join(tmpdir(), 'bankresaneh-api-smoke-'));
  const dbPath = join(tempDir, 'smoke.sqlite');
  const base = 'http://127.0.0.1:' + port;
  const logs = [];
  const child = spawn(process.env.BUN_BIN || 'bun', [resolve('mini-services/api-service/index.js')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      BANKRESANEH_HOST: '127.0.0.1',
      DB_PATH: dbPath,
      CORS_ORIGINS: 'http://127.0.0.1:3000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));

  const request = async (path, { method = 'GET', token, body } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  };

  try {
    const health = await waitForApi(base, child, logs);
    assert.equal(health.status, 'ok');
    const allowedCors = await fetch(base + '/api/health', { headers: { Origin: 'http://127.0.0.1:3000' } });
    assert.equal(allowedCors.headers.get('access-control-allow-origin'), 'http://127.0.0.1:3000',
      'configured frontend origin must pass CORS');
    const rejectedCors = await fetch(base + '/api/health', { headers: { Origin: 'https://untrusted.example' } });
    assert.equal(rejectedCors.headers.get('access-control-allow-origin'), '',
      'unconfigured frontend origins must not pass CORS');
    assert.equal((await request('/api/profile')).status, 401, 'profile must require authentication');

    let login = await request('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'admin' } });
    assert.equal(login.status, 200, 'seed admin must be able to log in');
    const initialToken = login.data.token;
    const adminId = login.data.user.id;
    assert.equal(login.data.user.mustChangePassword, true);

    const passwordChange = await request('/api/auth/change-password', {
      method: 'PUT', token: initialToken, body: { oldPassword: 'admin', newPassword: 'SmokeTest-Password-53!' },
    });
    assert.equal(passwordChange.status, 200, 'forced initial password change must work');

    login = await request('/api/auth/login', {
      method: 'POST', body: { username: 'admin', password: 'SmokeTest-Password-53!' },
    });
    assert.equal(login.status, 200, 'admin must log in after password change');
    const token = login.data.token;

    const profileUpdate = await request('/api/profile', {
      method: 'PUT', token, body: {
        username: 'smoke-admin-renamed', name: 'API Smoke Admin', jobTitle: 'QA', deputy: 'Test', avatar: '', phone: '0000000000',
      },
    });
    assert.equal(profileUpdate.status, 200);
    assert.equal(profileUpdate.data.name, 'API Smoke Admin');
    assert.equal(profileUpdate.data.username, 'smoke-admin-renamed');
    const renamedLogin = await request('/api/auth/login', {
      method: 'POST', body: { username: 'smoke-admin-renamed', password: 'SmokeTest-Password-53!' },
    });
    assert.equal(renamedLogin.status, 200, 'changed login name must work for next sign-in');
    assert.equal(profileUpdate.data.phone, '0000000000');

    const created = await request('/api/users', {
      method: 'POST', token, body: {
        username: 'smoke-editor', password: 'SmokeUser-Password-53!', role: 'editor', name: 'Smoke Editor',
      },
    });
    assert.equal(created.status, 200, 'admin must create an editor');
    const userId = created.data.id;

    const duplicateUsername = await request('/api/profile', {
      method: 'PUT', token, body: { username: 'smoke-editor' },
    });
    assert.equal(duplicateUsername.status, 409, 'duplicate login names must be rejected');

    const invalidRole = await request('/api/users?id=' + userId, {
      method: 'PUT', token, body: { role: 'superuser' },
    });
    assert.equal(invalidRole.status, 400, 'unknown roles must be rejected');

    const validRoleUpdate = await request('/api/users?id=' + userId, {
      method: 'PUT', token, body: { role: 'viewer' },
    });
    assert.equal(validRoleUpdate.status, 200);
    assert.equal(validRoleUpdate.data.role, 'viewer');

    const viewerLogin = await request('/api/auth/login', {
      method: 'POST', body: { username: 'smoke-editor', password: 'SmokeUser-Password-53!' },
    });
    assert.equal(viewerLogin.status, 200, 'created viewer must be able to log in');
    assert.equal((await request('/api/shows', { token: viewerLogin.data.token })).status, 200,
      'viewer may read the archive');
    assert.equal((await request('/api/users', { token: viewerLogin.data.token })).status, 401,
      'viewer may not manage users');
    assert.equal((await request('/api/shows', {
      method: 'POST', token: viewerLogin.data.token, body: { num: 990000002, name: 'forbidden' },
    })).status, 401, 'viewer may not add archive records');

    const selfDemotion = await request('/api/users?id=' + adminId, {
      method: 'PUT', token, body: { role: 'viewer' },
    });
    assert.equal(selfDemotion.status, 400, 'admin must not demote their own account');

    const selfDelete = await request('/api/users?id=' + adminId, { method: 'DELETE', token });
    assert.equal(selfDelete.status, 400, 'admin must not delete their own account');

    const createdShow = await request('/api/shows', {
      method: 'POST', token, body: {
        num: 990000001, name: 'آزمایش يک برنامه smokeprobe', category: 'آزمایش',
        summary: 'رکورد آزمایشی برای جست‌وجوی فارسی',
      },
    });
    assert.equal(createdShow.status, 200, 'editor-capable admin must create a show');

    const imageImport = await request('/api/fetch-image', {
      method: 'POST', token, body: {
        num: 990000001, wikipedia: 'https://en.wikipedia.org/wiki/Albert_Einstein', name: 'Albert Einstein',
      },
    });
    assert.equal(imageImport.status, 200, 'editor/admin must be able to import a Wikipedia image');
    const storedImage = await fetch(base + '/api/image/990000001', { signal: AbortSignal.timeout(15000) });
    assert.equal(storedImage.status, 200, 'imported image must be served from the API database');
    assert.ok((storedImage.headers.get('content-type') || '').startsWith('image/'));

    const normalizedSearch = await request('/api/shows/search?q=' + encodeURIComponent('یک برنامه smokeprobe'), { token });
    assert.equal(normalizedSearch.status, 200);
    assert.ok(normalizedSearch.data.shows.some((show) => show.num === 990000001),
      'Persian Yeh/Kaf normalization must find legacy Arabic variants. Response: ' + JSON.stringify(normalizedSearch.data));

    const relaxedSearch = await request('/api/shows/search?q=' + encodeURIComponent('یک برنامه واژه‌ناموجود smokeprobe'), { token });
    assert.equal(relaxedSearch.status, 200);
    assert.ok(relaxedSearch.data.shows.some((show) => show.num === 990000001),
      'Multi-term search must relax to relevant matching terms when strict AND finds nothing.');

    const emptySearch = await request('/api/shows/search?q=' + encodeURIComponent('عبارتکاملاًناموجود smokeprobe'), { token });
    assert.equal(emptySearch.status, 200);
    assert.equal(emptySearch.data.pagination.total, 0, 'unmatched queries must return an empty result set');

    const updateShow = await request('/api/shows/990000001', {
      method: 'PUT', token, body: { summary: 'متن به‌روزشده برای آزمون' },
    });
    assert.equal(updateShow.status, 200);
    assert.equal(updateShow.data.summary, 'متن به‌روزشده برای آزمون');

    const deleteShow = await request('/api/shows?num=990000001', { method: 'DELETE', token });
    assert.equal(deleteShow.status, 200);

    const deleteUser = await request('/api/users?id=' + userId, { method: 'DELETE', token });
    assert.equal(deleteUser.status, 200);

    const unauthSearch = await request('/api/shows/search?q=test');
    assert.equal(unauthSearch.status, 401, 'search must require authentication');

    console.log('API smoke passed: health, auth, password change, profile, user CRUD guards, Persian search, show CRUD, and access control.');
  } catch (error) {
    console.error(error);
    console.error(logs.join('').slice(-6000));
    process.exitCode = 1;
  } finally {
    child.kill();
    await new Promise((resolveExit) => {
      if (child.exitCode !== null) return resolveExit();
      child.once('exit', resolveExit);
      setTimeout(resolveExit, 3000);
    });
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
