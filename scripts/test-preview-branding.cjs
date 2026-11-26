/* eslint @typescript-eslint/no-require-imports: off */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EXPECTED = 'مانیتورینگ مرکز طرح و برنامه سیما';
const FORBIDDEN = [/تهیه[\\u200c ]شده برای/u, /Made\\s+for/i];
const ASSETS = ['client-logo.png', 'client-logo-white.png', 'banke-rasane-logo.png'];
const FEATURE_MARKERS = [
  'ظرفیت بهره‌برداری',
  'decorIncluded',
  'data:video/mp4', // current editor exports authenticated FFmpeg-transcoded MP4, not browser MediaRecorder WebM

  'ویکی‌پدیا',
  'IMDb',
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function assertBranding(chunks, label) {
  const source = chunks.join('\\n');
  assert(source.includes(EXPECTED), label + ': compiled app must contain the exact organization identity');
  for (const pattern of FORBIDDEN) {
    assert(!pattern.test(source), label + ': forbidden commissioning label found: ' + pattern);
  }
}

function assertFeatures(chunks, label) {
  const source = chunks.join('\\n');
  for (const marker of FEATURE_MARKERS) {
    assert(source.includes(marker), label + ': required UI feature missing from compiled bundle: ' + marker);
  }
}

async function localCheck() {
  const assetRoot = path.join(process.cwd(), '.open-next', 'assets');
  for (const name of ASSETS) {
    const file = path.join(assetRoot, name);
    assert(fs.existsSync(file), 'Missing deployed public asset: ' + name);
    assert(fs.statSync(file).size > 1000, 'Public asset is unexpectedly small: ' + name);
  }
  const jsFiles = walk(path.join(assetRoot, '_next', 'static', 'chunks')).filter(file => file.endsWith('.js'));
  assert(jsFiles.length > 0, 'No compiled Next.js JavaScript chunks found');
  const compiledChunks = jsFiles.map(file => fs.readFileSync(file, 'utf8'));
  assertBranding(compiledChunks, 'Local Cloudflare build');
  assertFeatures(compiledChunks, 'Local Cloudflare build');
  console.log('PASS local build contains exact branding, required capacity/decor/video/import UI, and all three logo assets.');
}

function cacheBusted(url, attempt) {
  const result = new URL(url);
  result.searchParams.set('__bankresaneh_deploy_check', Date.now() + '-' + attempt);
  return result.toString();
}

async function requestFresh(url, attempt) {
  return fetch(cacheBusted(url, attempt), {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache, no-store, max-age=0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
}

async function remoteCheck(base) {
  const deadline = Date.now() + 90_000;
  let attempt = 0;
  let lastFailure = 'No deployment response received';

  // Cloudflare can propagate a Worker version and its content-addressed assets
  // to different edge locations at slightly different times. Re-read the HTML
  // on every attempt; never retry an old chunk URL from a stale HTML response.
  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const rootResponse = await requestFresh(base + '/', attempt);
      if (rootResponse.status !== 200) {
        lastFailure = 'Preview root returned HTTP ' + rootResponse.status;
      } else {
        const html = await rootResponse.text();
        const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
        assert(scripts.length > 0, 'Preview HTML must reference compiled JavaScript chunks');

        const chunkResults = await Promise.all(scripts.map(async src => {
          const url = new URL(src, base).toString();
          const response = await requestFresh(url, attempt);
          return { url, status: response.status, body: response.ok ? await response.text() : '' };
        }));
        const failedChunk = chunkResults.find(item => item.status !== 200);
        if (failedChunk) {
          lastFailure = 'Chunk still unavailable at edge (HTTP ' + failedChunk.status + '): ' + failedChunk.url;
        } else {
          const logoResults = await Promise.all(ASSETS.map(async name => {
            const response = await requestFresh(new URL('/' + name, base).toString(), attempt);
            const bytes = response.ok ? new Uint8Array(await response.arrayBuffer()) : new Uint8Array();
            return { name, status: response.status, size: bytes.length };
          }));
          const failedLogo = logoResults.find(item => item.status !== 200 || item.size <= 1000);
          if (failedLogo) {
            lastFailure = 'Logo unavailable or incomplete: ' + failedLogo.name + ' (HTTP ' + failedLogo.status + ', ' + failedLogo.size + ' bytes)';
          } else {
            const chunks = chunkResults.map(item => item.body);
            assertBranding(chunks, 'Deployed preview');
            assertFeatures(chunks, 'Deployed preview');
            console.log('PASS deployed preview serves current compiled JS, exact organization identity, required features, and all logo assets after ' + attempt + ' edge check(s).');
            return;
          }
        }
      }
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      lastFailure = error.message || String(error);
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(3000, Math.max(500, deadline - Date.now()))));
  }

  throw new Error('Cloudflare deployment did not converge to a consistent HTML/asset version within 90 seconds. Last check: ' + lastFailure);
}

(async () => {
  const urlIndex = process.argv.indexOf('--url');
  if (urlIndex >= 0) await remoteCheck(process.argv[urlIndex + 1]);
  else await localCheck();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
