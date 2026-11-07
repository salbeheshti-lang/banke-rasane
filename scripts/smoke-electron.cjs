/* eslint @typescript-eslint/no-require-imports: off */
// Windows-only smoke test for the packaged Electron application.
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

// Use the executable path passed as a CLI argument or the BANKRESANEH_EXE env
// var (the CI workflow sets the env var to the NSIS-installed executable path).
// Fall back to the win-unpacked build for local `npm run smoke:desktop` runs.
const executable = path.resolve(
  process.env.BANKRESANEH_EXE ||
    process.argv[2] ||
    path.resolve(__dirname, '..', 'release', 'win-unpacked', 'BankResaneh.exe')
);
if (process.env.BANKRESANEH_EXE || process.argv[2]) {
  process.stdout.write('Smoke-testing installed executable: ' + executable + '\n');
} else {
  process.stdout.write('No executable argument — falling back to win-unpacked build: ' + executable + '\n');
}
let spawnError = null;
const child = spawn(executable, ['--disable-gpu', '--no-sandbox', '--enable-logging=stderr'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: false,
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
});
let childOutput = '';
child.stdout.on('data', (data) => {
  const value = data.toString();
  childOutput += value;
  process.stdout.write(value);
});
child.stderr.on('data', (data) => {
  const value = data.toString();
  childOutput += value;
  process.stderr.write(value);
});
child.on('error', (error) => { spawnError = error; });

function printStartupDiagnostics() {
  process.stderr.write('\\n--- Electron startup output ---\\n' + (childOutput || '(no child output)') + '\\n');
  const userDataMatch = childOutput.match(/UserData:\\s*(.+)/);
  const candidates = userDataMatch
    ? [path.join(userDataMatch[1].trim(), 'bankresaneh.log')]
    : [
        path.join(process.env.APPDATA || '', 'banke-rasane', 'bankresaneh.log'),
        path.join(process.env.APPDATA || '', 'BankResaneh', 'bankresaneh.log'),
      ];
  for (const logPath of candidates) {
    if (fs.existsSync(logPath)) {
      const lines = fs.readFileSync(logPath, 'utf8').split(/\\r?\\n/);
      process.stderr.write('\\n--- Electron log: ' + logPath + ' ---\\n' + lines.slice(-200).join('\\n') + '\\n');
      return;
    }
  }
}

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
  throw new Error(label + ' did not become ready: ' + lastError);
}

(async () => {
  try {
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
    printStartupDiagnostics();
    process.exitCode = 1;
  } finally {
    if (child.pid) {
      try {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {}
    }
  }
})();
