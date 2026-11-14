/* eslint @typescript-eslint/no-require-imports: off */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const port = Number(process.env.CLOUDFLARE_PREVIEW_PORT || 8787);
const base = 'http://127.0.0.1:' + port;
let output = '';
let child;

async function waitForPreview() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Wrangler preview exited early:\n' + output);
    try {
      const response = await fetch(base + '/manifest.webmanifest', { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Wrangler preview did not become ready:\n' + output);
}

async function main() {
  child = spawn('bunx', ['wrangler', 'dev', '--local', '--port', String(port)], {
    env: {
      ...process.env,
      BANKRESANEH_API_BASE: 'http://127.0.0.1:3002',
      BANKRESANEH_ALLOWED_API_ORIGINS: 'http://127.0.0.1:3002',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  await waitForPreview();

  const root = await fetch(base + '/');
  assert.equal(root.status, 200, 'Cloudflare Worker serves the Next.js app shell');

  const manifestResponse = await fetch(base + '/manifest.webmanifest');
  const manifest = await manifestResponse.json();
  assert.equal(manifest.name, 'بانک رسانه');
  assert.equal(manifest.display, 'standalone');

  const serviceWorker = await fetch(base + '/sw.js');
  assert.equal(serviceWorker.status, 200);
  assert.match(await serviceWorker.text(), /url\.pathname\.startsWith\('\/api\/'\)/);

  const offline = await fetch(base + '/offline.html');
  assert.equal(offline.status, 200);
  assert.match(await offline.text(), /بانک رسانه/);

  console.log('PASS Cloudflare Worker preview serves app shell, PWA manifest, service worker, and offline fallback.');
}

main().catch(error => {
  console.error(error);
  console.error(output);
  process.exitCode = 1;
}).finally(() => {
  try { if (child && child.exitCode === null) child.kill('SIGTERM'); } catch {}
});
