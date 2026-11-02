/* eslint @typescript-eslint/no-require-imports: off */
// Windows-only smoke test for the packaged Electron application.
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const executable = path.resolve(__dirname, '..', 'release', 'win-unpacked', 'BankResaneh.exe');
const child = spawn(executable, ['--disable-gpu', '--no-sandbox'], {
  stdio: 'ignore',
  windowsHide: false,
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
});

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
    if (child.exitCode !== null) {
      throw new Error('Electron exited early with code ' + child.exitCode + ' while waiting for ' + label);
    }
    try {
      const status = await getStatus(url);
      if (status >= 200 && status < 400) {
        process.stdout.write(label + ' ready (HTTP ' + status + ')\n');
        return;
      }
      lastError = 'HTTP ' + status;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(label + ' did not become ready: ' + lastError);
}

(async () => {
  try {
    child.on('error', (error) => { process.stderr.write('Electron spawn error: ' + error.message + '\n'); });
    await waitFor('http://127.0.0.1:3000/', 'Next.js UI');
    await waitFor('http://127.0.0.1:3002/api/health', 'Local API');
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
