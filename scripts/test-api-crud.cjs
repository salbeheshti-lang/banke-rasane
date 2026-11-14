/* eslint @typescript-eslint/no-require-imports: off */
const { spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');

const root = path.resolve(__dirname, '..');
const apiEntry = path.join(root, 'mini-services', 'api-service', 'index.js');
const tempDir = mkdtempSync(path.join(tmpdir(), 'bankresaneh-api-crud-'));
const dbPath = path.join(tempDir, 'test.sqlite');
const seedPath = path.join(tempDir, 'empty-seed.json');
writeFileSync(seedPath, '[]', 'utf8');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.env.BUN_BINARY || 'bun', ['run', apiEntry], {
    cwd: path.dirname(apiEntry),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      BANKRESANEH_HOST: '127.0.0.1',
      BANKRESANEH_SEED_PATH: seedPath,
      DB_PATH: dbPath,
    },
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });

  const request = async (route, options = {}) => {
    const response = await fetch(base + route, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
        ...options.headers,
      },
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    return { status: response.status, data };
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    console.log('PASS ' + message);
  };

  try {
    let ready = false;
    let lastError = '';
    for (let attempt = 0; attempt < 90; attempt++) {
      if (child.exitCode !== null) throw new Error('API exited early: ' + output);
      try {
        const response = await request('/api/health');
        if (response.status === 200 && response.data.status === 'ok') { ready = true; break; }
        lastError = 'HTTP ' + response.status;
      } catch (error) { lastError = error.message; }
      await sleep(500);
    }
    assert(ready, 'isolated API starts with a fresh SQLite database');

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    });
    assert(login.status === 200 && !!login.data.token, 'default test admin can authenticate');
    const change = await request('/api/auth/change-password', {
      method: 'PUT',
      token: login.data.token,
      body: JSON.stringify({ oldPassword: 'admin', newPassword: 'SmokeTest!2026' }),
    });
    assert(change.status === 200 && !!change.data.token, 'first-login password change unlocks admin permissions');
    const token = change.data.token;

    const num = 900001;
    const original = {
      num,
      name: 'BankResaneh CRUD Integration Fixture',
      category: 'سفر جاده‌ای',
      imdb: 'https://www.imdb.com/title/tt9876543/',
      wikipedia: '',
      videos: [],
      images: [],
      tags: [],
      decorIncluded: false,
    };
    const created = await request('/api/shows', {
      method: 'POST', token, body: JSON.stringify(original),
    });
    assert(created.status === 200 && created.data.num === num, 'new fixture show is created');

    const sameRecordUpdate = await request('/api/shows/' + num, {
      method: 'PUT', token,
      body: JSON.stringify({ name: original.name, imdb: original.imdb, summary: 'Edited without changing identity' }),
    });
    assert(sameRecordUpdate.status === 200 && sameRecordUpdate.data.num === num,
      'editing the same record with unchanged name and IMDb does not self-trigger duplicate detection');

    const decorTrue = await request('/api/shows/' + num, {
      method: 'PUT', token, body: JSON.stringify({ decorIncluded: true }),
    });
    assert(decorTrue.status === 200 && decorTrue.data.decorIncluded === true,
      'decorIncluded=true is saved and returned by the update endpoint');

    const omittedDecor = await request('/api/shows/' + num, {
      method: 'PUT', token, body: JSON.stringify({ summary: 'Edit that omits decorIncluded' }),
    });
    assert(omittedDecor.status === 200 && omittedDecor.data.decorIncluded === true,
      'omitting decorIncluded during an edit preserves its existing true value');

    const decorFalse = await request('/api/shows/' + num, {
      method: 'PUT', token, body: JSON.stringify({ decorIncluded: false }),
    });
    assert(decorFalse.status === 200 && decorFalse.data.decorIncluded === false,
      'decorIncluded=false is saved distinctly from an omitted value');

    const duplicate = await request('/api/shows', {
      method: 'POST', token,
      body: JSON.stringify({
        name: 'Different title but same IMDb fixture',
        imdb: original.imdb,
        category: 'کمدی',
        videos: [], images: [], tags: [],
      }),
    });
    assert(duplicate.status === 409 && duplicate.data.duplicate?.num === num,
      'creating a genuinely duplicate IMDb record is rejected with HTTP 409');
    assert(String(duplicate.data.error || '').includes('سفرنامه و ماجراجویی'),
      'duplicate error reports the canonical travel genre instead of the legacy alias');

    const sameNameDuplicate = await request('/api/shows', {
      method: 'POST', token,
      body: JSON.stringify({
        name: original.name,
        imdb: 'https://www.imdb.com/title/tt9876544/',
        category: 'مستند',
        videos: [], images: [], tags: [],
      }),
    });
    assert(sameNameDuplicate.status === 409,
      'creating a genuinely duplicate normalized title is rejected');

    const search = await request('/api/shows/search?q=BankResaneh%20CRUD%20Integration%20Fixture&limit=10', { token });
    const found = Array.isArray(search.data.shows)
      ? search.data.shows.find(show => show.num === num)
      : null;
    assert(search.status === 200 && !!found && found.decorIncluded === false,
      'persisted decor value is returned by a fresh authenticated search/read');

    // Shared genre attachments must be visible to every authenticated account/device.
    const genreForm = new FormData();
    genreForm.append('file', new Blob(['shared genre attachment'], { type: 'application/pdf' }), 'decor-reference.pdf');
    const genreUploadResponse = await fetch(base + '/api/genres/decor/file', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: genreForm,
    });
    const genreUpload = await genreUploadResponse.json().catch(() => ({}));
    assert(genreUploadResponse.status === 200 && genreUpload.success,
      'admin can upload a shared PDF attachment for a genre');

    const viewerCreated = await request('/api/users', {
      method: 'POST', token,
      body: JSON.stringify({ username: 'genre_file_viewer', password: 'ViewerFile!2026', role: 'viewer', name: 'Genre File Viewer' }),
    });
    assert(viewerCreated.status === 200, 'admin can create a viewer for shared attachment access tests');
    const viewerLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'genre_file_viewer', password: 'ViewerFile!2026' }),
    });
    assert(viewerLogin.status === 200 && !!viewerLogin.data.token, 'viewer can authenticate to read shared genre attachments');
    const viewerToken = viewerLogin.data.token;

    const genreInfo = await request('/api/genres/decor/file', { token: viewerToken });
    assert(genreInfo.status === 200 && genreInfo.data.name === 'decor-reference.pdf',
      'a different user can see the uploaded genre attachment metadata');
    const genreDownload = await fetch(base + '/api/genres/decor/file?download=1', {
      headers: { Authorization: 'Bearer ' + viewerToken },
    });
    assert(genreDownload.status === 200 && (await genreDownload.text()) === 'shared genre attachment',
      'a different user can download the exact shared genre attachment bytes');

    const viewerForm = new FormData();
    viewerForm.append('file', new Blob(['forbidden'], { type: 'application/pdf' }), 'viewer.pdf');
    const viewerUpload = await fetch(base + '/api/genres/decor/file', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + viewerToken },
      body: viewerForm,
    });
    assert(viewerUpload.status === 403, 'viewer cannot replace a shared genre attachment');
    const viewerDelete = await request('/api/genres/decor/file', { method: 'DELETE', token: viewerToken });
    assert(viewerDelete.status === 403, 'viewer cannot delete a shared genre attachment');

    const genreDelete = await request('/api/genres/decor/file', { method: 'DELETE', token });
    assert(genreDelete.status === 200, 'admin can delete a shared genre attachment');
    const genreMissing = await request('/api/genres/decor/file', { token: viewerToken });
    assert(genreMissing.status === 404, 'deleted genre attachment is no longer available to other users');

    // Profile, custom genres, activity, analytics, permissions, and session logout.
    const profileBefore = await request('/api/profile', { token });
    assert(profileBefore.status === 200, 'authenticated user can read their own profile');
    const profileUpdated = await request('/api/profile', {
      method: 'PUT', token,
      body: JSON.stringify({ name: 'CRUD Integration Admin', jobTitle: 'QA', deputy: 'Test Unit', phone: '000-TEST' }),
    });
    assert(profileUpdated.status === 200 && profileUpdated.data.name === 'CRUD Integration Admin',
      'user can update their own profile fields');
    const profileReadBack = await request('/api/profile', { token });
    assert(profileReadBack.data.jobTitle === 'QA' && profileReadBack.data.phone === '000-TEST',
      'profile changes persist across authenticated reads');

    const permissions = await request('/api/permissions', { token });
    assert(permissions.status === 200 && permissions.data.permissions.includes('manage_users'),
      'admin can retrieve the permission catalogue');
    const users = await request('/api/users', { token });
    assert(users.status === 200 && users.data.users.some(user => user.username === 'genre_file_viewer'),
      'admin can list managed user accounts');

    const genreId = 'integration-test-genre';
    const genreCreated = await request('/api/genres', {
      method: 'POST', token,
      body: JSON.stringify({
        id: genreId,
        nameFa: 'ژانر آزمایشی یکپارچه',
        name: 'Integration Test Genre',
        color: '#126B50',
        description: 'Genre API integration test',
        aliases: ['ژانر قدیمی آزمایشی'],
      }),
    });
    assert(genreCreated.status === 200 && genreCreated.data.genre?.id === genreId,
      'admin can create a custom genre');
    const genreFixture = await request('/api/shows', {
      method: 'POST', token,
      body: JSON.stringify({ num: 900002, name: 'Genre Migration Fixture', category: 'ژانر آزمایشی یکپارچه' }),
    });
    assert(genreFixture.status === 200, 'show can be assigned to the custom genre');
    const genreUpdated = await request('/api/genres?id=' + genreId, {
      method: 'PUT', token,
      body: JSON.stringify({
        nameFa: 'ژانر آزمایشی به‌روزشده',
        name: 'Updated Integration Test Genre',
        color: '#227755',
        description: 'Updated genre test',
        aliases: ['ژانر آزمایشی یکپارچه'],
      }),
    });
    assert(genreUpdated.status === 200 && genreUpdated.data.migratedCount === 1,
      'renaming a custom genre migrates existing show categories');
    const migratedSearch = await request('/api/shows/search?q=' + encodeURIComponent('Genre Migration Fixture'), { token });
    const migratedShow = migratedSearch.data.shows?.find(show => Number(show.num) === 900002);
    assert(migratedShow?.category === 'ژانر آزمایشی به‌روزشده',
      'renamed custom genre is reflected in the searchable show record');
    const genreDeleted = await request('/api/genres?id=' + genreId, { method: 'DELETE', token });
    assert(genreDeleted.status === 200 && genreDeleted.data.affectedShows === 1,
      'deleting a custom genre deactivates it and clears its assigned show category');
    const clearedSearch = await request('/api/shows/search?q=' + encodeURIComponent('Genre Migration Fixture'), { token });
    const clearedShow = clearedSearch.data.shows?.find(show => Number(show.num) === 900002);
    assert(clearedShow?.category === '',
      'deactivated custom genre is removed from affected show records');
    const fixtureDeleted = await request('/api/shows?num=900002', { method: 'DELETE', token });
    assert(fixtureDeleted.status === 200, 'admin can delete the custom genre migration fixture');

    const tracked = await request('/api/analytics/track', {
      method: 'POST', token,
      body: JSON.stringify({ action: 'view_show', targetType: 'show', targetId: '900001', details: 'integration test' }),
    });
    assert(tracked.status === 200 && tracked.data.success, 'authenticated user actions can be recorded for analytics');
    const analytics = await request('/api/analytics/report?days=7', { token });
    assert(analytics.status === 200 && analytics.data.totals.views >= 1,
      'admin analytics report aggregates recorded activity');
    const activity = await request('/api/activity?limit=50', { token });
    assert(activity.status === 200 && activity.data.logs.some(log => log.action === 'view_show'),
      'activity log exposes the recorded audit event to an authorized admin');

    const logout = await request('/api/auth/logout', { method: 'POST', token, body: '{}' });
    assert(logout.status === 200 && logout.data.success, 'authenticated user can log out');
    const loggedOutMe = await request('/api/auth/me', { token });
    assert(loggedOutMe.status === 401, 'logged-out session token is rejected');

    console.log('API CRUD integration suite completed successfully.');
  } catch (error) {
    console.error(error.stack || error);
    console.error('API process output:\n' + output);
    process.exitCode = 1;
  } finally {
    try { child.kill(); } catch {}
    await sleep(300);
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
