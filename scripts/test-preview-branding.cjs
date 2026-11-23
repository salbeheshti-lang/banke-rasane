'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EXPECTED = 'مانیتورینگ مرکز طرح و برنامه سیما';
const FORBIDDEN = [/تهیه[\u200c ]شده برای/u, /Made\s+for/i];
const ASSETS = ['client-logo.png', 'client-logo-white.png', 'banke-rasane-logo.png'];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function assertBranding(chunks, label) {
  const source = chunks.join('\n');
  assert(source.includes(EXPECTED), label + ': compiled app must contain the exact organization identity');
  for (const pattern of FORBIDDEN) {
    assert(!pattern.test(source), label + ': forbidden commissioning label found: ' + pattern);
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
  assertBranding(jsFiles.map(file => fs.readFileSync(file, 'utf8')), 'Local Cloudflare build');
  console.log('PASS local build contains exact organization identity, no commissioning label, and all three logo assets.');
}

async function remoteCheck(base) {
  const rootResponse = await fetch(base + '/', { redirect: 'follow' });
  assert.equal(rootResponse.status, 200, 'Preview root must return HTTP 200');
  const html = await rootResponse.text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert(scripts.length > 0, 'Preview HTML must reference compiled JavaScript chunks');
  const chunks = await Promise.all(scripts.map(async src => {
    const url = new URL(src, base).toString();
    const response = await fetch(url);
    assert.equal(response.status, 200, 'Compiled JS asset must load: ' + url);
    return response.text();
  }));
  assertBranding(chunks, 'Deployed preview');
  for (const name of ASSETS) {
    const response = await fetch(new URL('/' + name, base));
    assert.equal(response.status, 200, 'Organization/app logo must load: ' + name);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert(bytes.length > 1000, 'Logo asset is unexpectedly small: ' + name);
  }
  console.log('PASS deployed preview serves exact organization identity, no commissioning label, and all logo assets.');
}

(async () => {
  const urlIndex = process.argv.indexOf('--url');
  if (urlIndex >= 0) await remoteCheck(process.argv[urlIndex + 1]);
  else await localCheck();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
