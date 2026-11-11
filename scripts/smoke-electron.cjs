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
const child = spawn(executable, ['--disable-gpu', '--no-sandbox', '--enable-logging=stderr', '--remote-debugging-port=9229'], {
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
  process.stderr.write('\n--- Electron startup output ---\n' + (childOutput || '(no child output)') + '\n');
  const userDataMatch = childOutput.match(/UserData:\s*(.+)/);
  const candidates = userDataMatch
    ? [path.join(userDataMatch[1].trim(), 'bankresaneh.log')]
    : [
        path.join(process.env.APPDATA || '', 'banke-rasane', 'bankresaneh.log'),
        path.join(process.env.APPDATA || '', 'BankResaneh', 'bankresaneh.log'),
      ];
  for (const logPath of candidates) {
    if (fs.existsSync(logPath)) {
      const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
      process.stderr.write('\n--- Electron log: ' + logPath + ' ---\n' + lines.slice(-200).join('\n') + '\n');
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

async function verifyLoginScreen(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'DevTools target not available';
  while (Date.now() < deadline) {
    try {
      const response = await getResponse('http://127.0.0.1:9229/json/list');
      const page = JSON.parse(response.body).find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) {
        const socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          socket.addEventListener('open', resolve, { once: true });
          socket.addEventListener('error', reject, { once: true });
        });
        let commandId = 0;
        const pending = new Map();
        socket.addEventListener('message', (event) => {
          const message = JSON.parse(event.data);
          if (message.id && pending.has(message.id)) {
            const entry = pending.get(message.id);
            pending.delete(message.id);
            message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
          }
        });
        const stateResult = await new Promise((resolve, reject) => {
          const id = ++commandId;
          pending.set(id, { resolve, reject });
          socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: {
            expression: "(async () => { const user = !!document.querySelector('#login-username'); const password = !!document.querySelector('#login-password'); const login = !!document.querySelector('.login-screen'); const videoCapture = typeof HTMLVideoElement.prototype.captureStream === 'function'; const canvasCapture = typeof HTMLCanvasElement.prototype.captureStream === 'function'; const mimeType = typeof MediaRecorder === 'undefined' ? '' : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type)) || ''; let webmBytes = 0; let webmPlayable = false; if (videoCapture && canvasCapture && mimeType) { const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32; const context = canvas.getContext('2d'); const stream = canvas.captureStream(12); const recorder = new MediaRecorder(stream, { mimeType }); const chunks = []; const blobPromise = new Promise(resolve => { recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); }; recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType })); }); recorder.start(100); const draw = () => { context.fillStyle = 'rgb(' + (Math.floor(Math.random() * 200) + 20) + ',80,120)'; context.fillRect(0, 0, 32, 32); }; const drawTimer = setInterval(draw, 40); await new Promise(resolve => setTimeout(resolve, 700)); clearInterval(drawTimer); if (recorder.state !== 'inactive') recorder.stop(); const blob = await blobPromise; webmBytes = blob.size; stream.getTracks().forEach(track => track.stop()); if (webmBytes > 0) { const url = URL.createObjectURL(blob); const video = document.createElement('video'); video.muted = true; video.src = url; webmPlayable = await new Promise(resolve => { const timeout = setTimeout(() => resolve(false), 3000); video.onloadedmetadata = () => { clearTimeout(timeout); resolve(Number.isFinite(video.duration) && video.duration > 0); }; video.onerror = () => { clearTimeout(timeout); resolve(false); }; video.load(); }); URL.revokeObjectURL(url); } } return { user, password, login, url: location.href, videoCapture, canvasCapture, mimeType, webmBytes, webmPlayable }; })()",
            returnByValue: true,
            awaitPromise: true
          }}));
        });
        socket.close();
        const state = stateResult.result && stateResult.result.value;
        if (state && state.user && state.password && state.login && state.videoCapture && state.canvasCapture && state.webmBytes > 0 && state.webmPlayable) {
          process.stdout.write('Fresh desktop launch displays the login screen (' + state.url + ') and its WebM recording/export preview pipeline passed (' + state.webmBytes + ' bytes).\\n');
          return;
        }
        lastError = 'Login form missing: ' + JSON.stringify(state);
      }
    } catch (error) { lastError = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Fresh desktop launch did not display the required username/password login screen: ' + lastError);
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
    await verifyLoginScreen();
    process.stdout.write('Packaged Electron smoke test passed.\n');
  } catch (error) {
    process.stderr.write(error.stack || error.message);
    printStartupDiagnostics();
    process.exitCode = 1;
  } finally {
    if (child.pid) {
      process.stdout.write('Stopping packaged app process tree...\n');
      try {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          timeout: 10000,
        });
      } catch (error) {
        process.stderr.write('taskkill cleanup timed out or failed: ' + error.message + '\n');
        try { child.kill(); } catch {}
      }
    }
  }
})();
