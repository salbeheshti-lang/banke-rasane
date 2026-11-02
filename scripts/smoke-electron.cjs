/* eslint @typescript-eslint/no-require-imports: off */
// Windows-only smoke test for the packaged Electron application.
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const executable = path.resolve(__dirname, '..', 'release', 'win-unpacked', 'BankResaneh.exe');
let spawnError = null;
let childOutput = '';
const child = spawn(executable, ['--disable-gpu', '--no-sandbox', '--enable-logging=stderr'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: false,
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
});

function appendOutput(stream, label) {
  if (!stream) return;
  stream.on('data', (chunk) => {
    const value = chunk.toString();
    childOutput = (childOutput + '[' + label + '] ' + value).slice(-24000);
    process.stdout.write('[' + label + '] ' + value);
  });
}
appendOutput(child.stdout, 'electron:out');
appendOutput(child.stderr, 'electron:err');
child.on('error', (error) => { spawnError = error; });

function getResponse(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode || 0,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.setTimeout(2500, () => request.destroy(new Error('request timeout')));
    request.on('error', reject);
  });
}

async function waitFor(url, label, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    if (spawnError) throw new Error('Electron failed to spawn: ' + spawnError.message);
    if (child.exitCode !== null) {
      throw new Error('Electron exited early with code ' + child.exitCode + ' while waiting for ' + label);
    }
    try {
      const response = await getResponse(url);
      if (response.statusCode >= 200 && response.statusCode < 400) {
        process.stdout.write(label + ' ready (HTTP ' + response.statusCode + ')\n');
        return response;
      }
      lastError = 'HTTP ' + response.statusCode;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(label + ' did not become ready: ' + lastError + '\nElectron output:\n' + (childOutput || '(no process output captured)'));
}

(async () => {
  try {
    // Verify electron-builder embedded the GitHub update feed in the installed app.
    const releaseDir = path.resolve(__dirname, '..', 'release');
    const updateConfigPath = path.join(releaseDir, 'win-unpacked', 'resources', 'app-update.yml');
    const latestManifestPath = path.join(releaseDir, 'latest.yml');
    if (!fs.existsSync(updateConfigPath)) throw new Error('Packaged app is missing resources/app-update.yml.');
    const updateConfig = fs.readFileSync(updateConfigPath, 'utf8');
    for (const expected of ['provider: github', 'owner: salbeheshti-lang', 'repo: banke-rasane']) {
      if (!updateConfig.includes(expected)) throw new Error('Invalid updater configuration: missing ' + expected);
    }
    if (!fs.existsSync(latestManifestPath)) throw new Error('Build output is missing latest.yml update manifest.');
    const latestManifest = fs.readFileSync(latestManifestPath, 'utf8');
    if (!latestManifest.includes('version:') || !latestManifest.includes('sha512:')) {
      throw new Error('Update manifest is incomplete.');
    }
    process.stdout.write('Packaged auto-update metadata verified.\n');

    await waitFor('http://127.0.0.1:3000/', 'Next.js UI');
    const apiHealth = await waitFor('http://127.0.0.1:3002/api/health', 'Local API');
    const healthData = JSON.parse(apiHealth.body);
    if (!Number.isFinite(healthData.showsCount) || healthData.showsCount < 1) {
      throw new Error('API started but the archive database is empty.');
    }
    process.stdout.write('Archive database ready (' + healthData.showsCount + ' shows).\n');
    const searchProbe = await getResponse('http://127.0.0.1:3002/api/shows/search?q=bank');
    if (searchProbe.statusCode !== 401) {
      throw new Error('Archive search endpoint did not enforce authentication (HTTP ' + searchProbe.statusCode + ').');
    }
    process.stdout.write('Archive search endpoint is reachable and protected.\n');
    process.stdout.write('Packaged Electron smoke test passed.\n');
  } catch (error) {
    process.stderr.write(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (child.pid) {
      try {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {}
    }
  }
})();
