import { Database } from 'bun:sqlite';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiEntry = join(root, 'mini-services', 'api-service', 'index.js');
const seedPath = join(root, 'public', 'talk-shows-data.json');
const expected = JSON.parse(readFileSync(seedPath, 'utf8'));
if (!Array.isArray(expected) || !expected.length) throw new Error('Bundled archive JSON is empty or invalid.');

const tempDir = mkdtempSync(join(tmpdir(), 'bankresaneh-seed-runtime-'));
const dbPath = join(tempDir, 'fresh.sqlite');
const output = [];
let child;
let db;
let port;

async function reservePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  const value = address && typeof address === 'object' ? address.port : 0;
  await new Promise(resolvePromise => server.close(resolvePromise));
  return value;
}

async function waitForApi(base) {
  const deadline = Date.now() + 45_000;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('API exited before readiness:\n' + output.join(''));
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1500) });
      if (response.ok) return response.json();
      lastError = 'HTTP ' + response.status;
    } catch (error) {
      lastError = error.message;
    }
    await Bun.sleep(250);
  }
  throw new Error('API did not become ready: ' + lastError + '\n' + output.join(''));
}

try {
  port = await reservePort();
  child = spawn(process.env.BUN_BINARY || 'bun', [apiEntry], {
    cwd: dirname(apiEntry),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      BANKRESANEH_HOST: '127.0.0.1',
      BANKRESANEH_TRUSTED_PROXIES: '',
      BANKRESANEH_SEED_PATH: seedPath,
      DB_PATH: dbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', chunk => output.push(chunk.toString()));
  child.stderr.on('data', chunk => output.push(chunk.toString()));

  const base = 'http://127.0.0.1:' + port;
  const health = await waitForApi(base);
  db = new Database(dbPath, { readonly: true });
  const actual = db.prepare('SELECT num, name, category FROM shows ORDER BY num').all();
  const expectedSorted = [...expected].sort((a, b) => Number(a.num) - Number(b.num));
  const normalize = value => String(value || '').normalize('NFKC').trim();

  if (actual.length !== expectedSorted.length || health.showsCount !== expectedSorted.length) {
    throw new Error(`Fresh install count mismatch: JSON=${expectedSorted.length}, SQLite=${actual.length}, API health=${health.showsCount}`);
  }
  for (let i = 0; i < expectedSorted.length; i++) {
    const source = expectedSorted[i];
    const stored = actual[i];
    if (Number(stored.num) !== Number(source.num) ||
        normalize(stored.name) !== normalize(source.name) ||
        normalize(stored.category) !== normalize(source.category)) {
      throw new Error(`Fresh install archive mismatch at row ${i + 1}: JSON #${source.num} vs SQLite #${stored?.num}`);
    }
  }

  console.log(JSON.stringify({
    result: 'PASS',
    jsonCount: expectedSorted.length,
    sqliteCount: actual.length,
    apiHealthCount: health.showsCount,
    exactIdsNamesCategories: true,
    minId: actual[0]?.num ?? null,
    maxId: actual.at(-1)?.num ?? null,
  }, null, 2));
} finally {
  try { db?.close(); } catch {}
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolvePromise => child.once('exit', resolvePromise)),
      Bun.sleep(3000),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  rmSync(tempDir, { recursive: true, force: true });
}
