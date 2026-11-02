/* eslint @typescript-eslint/no-require-imports: off */
// Exercise the deployed Next.js metadata route against Wikipedia's public API.
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const port = 3100 + Math.floor(Math.random() * 500);
const base = 'http://127.0.0.1:' + port;
const serverPath = path.resolve(__dirname, '..', '.next', 'standalone', 'server.js');
const child = spawn(process.execPath, [serverPath], {
  cwd: path.dirname(serverPath),
  env: { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1', NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', (chunk) => { output = (output + chunk.toString()).slice(-8000); });
child.stderr.on('data', (chunk) => { output = (output + chunk.toString()).slice(-8000); });

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Next server exited early: ' + output);
    try {
      const response = await fetch(base + '/', { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {}
    await delay(300);
  }
  throw new Error('Next server readiness timeout: ' + output);
}

async function post(url) {
  const response = await fetch(base + '/api/fetch-show-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, data: await response.json() };
}

(async () => {
  try {
    await waitForServer();

    const directWiki = await post('https://en.wikipedia.org/wiki/Albert_Einstein');
    assert.equal(directWiki.status, 200, 'direct Wikipedia page import must work');
    assert.ok(directWiki.data.info?.title, 'direct Wikipedia import must return a title');
    assert.ok(directWiki.data.info?.description, 'direct Wikipedia import must return a description');

    const wikiSearch = await post('https://en.wikipedia.org/w/index.php?search=Albert%20Einstein');
    assert.equal(wikiSearch.status, 200, 'Wikipedia search-result URL import must work');
    assert.ok(wikiSearch.data.info?.title, 'Wikipedia search import must return a title');

    const unsupported = await post('https://example.com/not-a-source');
    assert.equal(unsupported.status, 400, 'unsupported metadata domains must be rejected');

    if (!process.env.OMDB_API_KEY) {
      const imdbWithoutKey = await post('https://www.imdb.com/title/tt0133093/');
      assert.equal(imdbWithoutKey.status, 503, 'IMDb import must clearly report missing OMDb configuration');
    }

    console.log('Metadata smoke passed: direct Wikipedia page, Wikipedia search URL, domain validation' +
      (process.env.OMDB_API_KEY ? ', IMDb configured' : ', IMDb missing-key handling') + '.');
  } catch (error) {
    console.error(error);
    console.error(output);
    process.exitCode = 1;
  } finally {
    child.kill();
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      delay(3000),
    ]);
  }
})();
