/* eslint @typescript-eslint/no-require-imports: off */
const { spawn } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const apiEntry = path.join(root, 'mini-services', 'api-service', 'index.js');
const nextEntry = path.join(root, '.next', 'standalone', 'server.js');
const tempDir = mkdtempSync(path.join(tmpdir(), 'bankresaneh-next-api-'));
const dataDir = path.join(tempDir, 'data');
const dbPath = path.join(tempDir, 'api.sqlite');
const seedPath = path.join(tempDir, 'empty-seed.json');
const startupToken = crypto.randomBytes(32).toString('hex');
mkdirSync(dataDir, { recursive: true });
writeFileSync(seedPath, '[]', 'utf8');

const children = [];
let output = '';

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

function launch(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  children.push(child);
  return child;
}

async function waitFor(url, label, headers = {}, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    for (const child of children) {
      if (child.exitCode !== null) throw new Error(label + ' dependency exited early.\n' + output);
    }
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(2500) });
      if (response.ok) return response;
      lastError = 'HTTP ' + response.status;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error(label + ' did not become ready: ' + lastError + '\n' + output);
}

async function request(base, route, options = {}) {
  const headers = { ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}), ...(options.headers || {}) };
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string' && !Buffer.isBuffer(body)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(base + route, {
    method: options.method || 'GET',
    headers,
    body,
    signal: AbortSignal.timeout(20000),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text();
  return { status: response.status, data, contentType, headers: response.headers };
}

function assert(condition, message) {
  if (!condition) throw new Error('FAIL ' + message);
  console.log('PASS ' + message);
}

async function main() {
  const apiPort = await freePort();
  const nextPort = await freePort();
  const apiBase = 'http://127.0.0.1:' + apiPort;
  const nextBase = 'http://127.0.0.1:' + nextPort;
  const bun = process.env.BUN_BINARY || 'bun';

  launch(bun, [apiEntry], {
    cwd: path.dirname(apiEntry),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(apiPort),
      BANKRESANEH_HOST: '127.0.0.1',
      BANKRESANEH_SEED_PATH: seedPath,
      DB_PATH: dbPath,
    },
  });
  await waitFor(apiBase + '/api/health', 'Bun API');

  if (!require('node:fs').existsSync(nextEntry)) {
    throw new Error('Next.js standalone server is missing. Run the production build before this test.');
  }

  launch(process.execPath, [nextEntry], {
    cwd: path.dirname(nextEntry),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(nextPort),
      HOSTNAME: '127.0.0.1',
      BANKRESANEH_API_BASE: apiBase,
      BANKRESANEH_STARTUP_TOKEN: startupToken,
      BANKRESANEH_DATA_DIR: dataDir,
      DATABASE_URL: 'file:' + path.join(tempDir, 'translation.sqlite').replace(/\\\\/g, '/'),
    },
  });
  await waitFor(nextBase + '/api/internal/ready', 'Next.js server', {
    'x-bankresaneh-startup-token': startupToken,
  });

  // Public health and private startup handshake.
  const health = await request(apiBase, '/api/health');
  assert(health.status === 200 && health.data.status === 'ok', 'API health endpoint is public and healthy');
  const privateReady = await request(nextBase, '/api/internal/ready', {
    headers: { 'x-bankresaneh-startup-token': startupToken },
  });
  assert(privateReady.status === 200, 'Next.js private readiness endpoint accepts only the startup token');
  const deniedReady = await request(nextBase, '/api/internal/ready');
  assert(deniedReady.status === 404, 'Next.js private readiness endpoint hides itself without the startup token');

  // Next.js route auth: anonymous callers must be rejected before side effects.
  const guardedRoutes = [
    ['/api/fetch-show-info', 'POST', { url: 'not-a-url' }],
    ['/api/translate', 'POST', { fields: {} }],
    ['/api/publish-social', 'POST', { platform: 'invalid', token: 'bad' }],
    ['/api/export-pdf', 'POST', { shows: [{ num: 1, name: 'Auth probe' }] }],
    ['/api/settings/report', 'POST', { title: 'Should not save' }],
  ];
  for (const [route, method, body] of guardedRoutes) {
    const response = await request(nextBase, route, { method, body });
    assert(response.status === 401, route + ' rejects anonymous requests');
  }
  const anonymousLogo = await request(nextBase, '/api/settings/logo');
  assert(anonymousLogo.status === 401, 'logo endpoint rejects anonymous requests');

  // First-login admin must change the seeded password before using gated routes.
  const firstLogin = await request(apiBase, '/api/auth/login', {
    method: 'POST', body: { username: 'admin', password: 'admin' },
  });
  assert(firstLogin.status === 200 && firstLogin.data.user?.mustChangePassword, 'fresh admin login requires a password change');
  const firstToken = firstLogin.data.token;
  const blockedFirstLogin = await request(nextBase, '/api/fetch-show-info', {
    method: 'POST', token: firstToken, body: { url: 'not-a-url', isDecor: true },
  });
  assert(blockedFirstLogin.status === 403, 'Next.js permission routes block first-login sessions until password change');

  const changed = await request(apiBase, '/api/auth/change-password', {
    method: 'PUT', token: firstToken,
    body: { oldPassword: 'admin', newPassword: 'NextRouteTest!2026' },
  });
  assert(changed.status === 200 && !!changed.data.token, 'admin password change rotates the session token');
  const adminToken = changed.data.token;

  // Create a viewer and verify the same permission boundaries in Next.js routes.
  const viewerCreated = await request(apiBase, '/api/users', {
    method: 'POST', token: adminToken,
    body: { username: 'route_viewer', password: 'ViewerRoute!2026', role: 'viewer', name: 'Route Viewer' },
  });
  assert(viewerCreated.status === 200, 'admin can create a viewer for permission tests');
  const viewerLogin = await request(apiBase, '/api/auth/login', {
    method: 'POST', body: { username: 'route_viewer', password: 'ViewerRoute!2026' },
  });
  assert(viewerLogin.status === 200, 'viewer can authenticate');
  const viewerToken = viewerLogin.data.token;

  for (const route of ['/api/fetch-show-info', '/api/translate', '/api/publish-social', '/api/export-pdf', '/api/settings/logo']) {
    const response = await request(nextBase, route, {
      method: route === '/api/settings/logo' ? 'GET' : 'POST',
      token: viewerToken,
      body: route === '/api/settings/logo' ? undefined : {},
    });
    assert(response.status === 403, route + ' rejects a viewer without the required permission');
  }
  const viewerReportSettings = await request(nextBase, '/api/settings/report', { token: viewerToken });
  assert(viewerReportSettings.status === 200, 'authenticated viewer can read non-sensitive report defaults');

  // Admin success paths for local Next.js features; external services are not contacted.
  const reportSaved = await request(nextBase, '/api/settings/report', {
    method: 'POST', token: adminToken,
    body: { title: 'Integration report', subtitle: 'Route test', organization: 'BankResaneh CI' },
  });
  assert(reportSaved.status === 200 && reportSaved.data.ok, 'admin can save report settings');
  const reportRead = await request(nextBase, '/api/settings/report', { token: adminToken });
  assert(reportRead.status === 200 && reportRead.data.title === 'Integration report', 'report settings persist and can be read');

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p2sAAAAASUVORK5CYII=',
    'base64'
  );
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'test-logo.png');
  const logoSaved = await request(nextBase, '/api/settings/logo', { method: 'POST', token: adminToken, body: form });
  assert(logoSaved.status === 200 && logoSaved.data.ok, 'admin can upload and normalize a custom logo');
  const logoRead = await request(nextBase, '/api/settings/logo', { token: adminToken });
  assert(logoRead.status === 200 && logoRead.contentType.includes('image/png'), 'uploaded custom logo can be read through the authenticated route');

  const exportHtml = await request(nextBase, '/api/export-pdf', {
    method: 'POST', token: adminToken,
    body: { shows: [{ num: 1, name: 'Integration Show', category: 'مصاحبه', summary: 'Test', descriptionFa: 'تست', images: [] }] },
  });
  assert(exportHtml.status === 200 && exportHtml.contentType.includes('text/html') && String(exportHtml.data).includes('Integration report'),
    'PDF export route generates printable report HTML using saved settings');

  const importValidation = await request(nextBase, '/api/fetch-show-info', {
    method: 'POST', token: adminToken,
    body: { url: 'not-a-url', category: 'تاک‌شوی مصاحبه‌محور', showName: 'Integration Show', isDecor: true },
  });
  assert(importValidation.status === 400, 'authorized IMDb/Wikipedia import route validates URL before external lookup');

  const socialValidation = await request(nextBase, '/api/publish-social', {
    method: 'POST', token: adminToken,
    body: { platform: 'invalid', token: 'bad' },
  });
  assert(socialValidation.status === 400, 'authorized social publishing route validates platform and token before sending');

  console.log('Next.js API route integration suite completed successfully.');
}

main().catch(error => {
  console.error(error.stack || error);
  console.error('Process output:\n' + output);
  process.exitCode = 1;
}).finally(() => {
  for (const child of children) {
    try { child.kill(); } catch {}
  }
  setTimeout(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }, 300);
});
