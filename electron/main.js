// Electron Main Process — بانک رسانه
// Starts the Bun API service (port 3002) and the Next.js standalone server
// (port 3000), then opens a window pointed at the Next.js UI.
const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let nextServer = null;
let apiServer = null;
const NEXT_PORT = 3000;
const API_PORT = 3002;
const NEXT_URL = `http://127.0.0.1:${NEXT_PORT}`;

function getLogPath() {
  return path.join(app.getPath('userData'), 'bankresaneh.log');
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  try { fs.appendFileSync(getLogPath(), line); } catch(e) {}
}

// === Locate the Next.js standalone server.js ===
function getNextServerPath() {
  const paths = [
    path.join(process.resourcesPath || '', 'next-service-dist', 'server.js'),
    path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
    path.join(__dirname, '..', 'next-service-dist', 'server.js'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) { log('Found Next server: ' + p); return p; }
  }
  log('Next server NOT FOUND. Paths checked: ' + JSON.stringify(paths));
  log('resourcesPath: ' + process.resourcesPath);
  log('__dirname: ' + __dirname);
  return null;
}

function getStaticDir() {
  const paths = [
    path.join(process.resourcesPath || '', 'next-service-dist'),
    path.join(__dirname, '..', '.next', 'standalone'),
    path.join(__dirname, '..', 'next-service-dist'),
  ];
  for (const p of paths) {
    if (fs.existsSync(path.join(p, 'server.js'))) { log('Static dir: ' + p); return p; }
  }
  return paths[0];
}

// === Locate the Bun API service ===
function getApiServicePath() {
  const paths = [
    path.join(process.resourcesPath || '', 'api-service', 'index.js'),
    path.join(__dirname, '..', 'mini-services', 'api-service', 'index.js'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) { log('Found API service: ' + p); return p; }
  }
  log('API service NOT FOUND — skipping');
  return null;
}

function getApiStaticDir() {
  const paths = [
    path.join(process.resourcesPath || '', 'api-service'),
    path.join(__dirname, '..', 'mini-services', 'api-service'),
  ];
  for (const p of paths) {
    if (fs.existsSync(path.join(p, 'index.js'))) return p;
  }
  return paths[0];
}

// === Start the API service (Bun on port 3002) ===
function startApiService() {
  return new Promise((resolve, reject) => {
    const apiPath = getApiServicePath();
    if (!apiPath) { log('API service not found — skipping'); resolve(); return; }
    const apiDir = getApiStaticDir();
    const userData = app.getPath('userData');
    const dbDir = path.join(userData, 'db');
    const dbPath = path.join(dbDir, 'bankresaneh.sqlite');

    try { if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, {recursive: true}); } catch(e) {}

    // Copy bundled DB on first run
    const bundledDb = path.join(apiDir, 'bankresaneh.sqlite');
    if (!fs.existsSync(dbPath) && fs.existsSync(bundledDb)) {
      try { fs.copyFileSync(bundledDb, dbPath); log('Copied initial API db'); } catch(e) {}
    }

    log('Starting API service: ' + apiPath);
    log('API cwd: ' + apiDir);
    log('API db: ' + dbPath);

    // Try bun first; fall back to node
    let cmd = 'bun';
    let args = [apiPath];
    try { require('child_process').execSync('bun --version', { stdio: 'ignore' }); }
    catch {
      cmd = process.execPath;
      args = [apiPath];
      log('WARNING: bun not found; API service requires bun:sqlite.');
    }

    apiServer = spawn(cmd, args, {
      cwd: apiDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(API_PORT),
        DB_PATH: dbPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    apiServer.stdout.on('data', (d) => { const t = d.toString().trim(); if(t) log('[api] ' + t); });
    apiServer.stderr.on('data', (d) => { const t = d.toString().trim(); if(t) log('[api err] ' + t); });
    apiServer.on('error', (err) => { log('API process error: ' + err.message); });

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      http.get('http://127.0.0.1:' + API_PORT + '/api/health', (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval); log('API service ready!'); resolve();
        }
      }).on('error', () => {
        if (attempts >= 60) {
          clearInterval(interval);
          log('API service failed to start after 60 attempts');
          resolve(); // Don't reject — Next.js can still run
        }
      });
    }, 500);
  });
}

// === Start the Next.js standalone server ===
function startNextServer() {
  return new Promise((resolve, reject) => {
    const serverPath = getNextServerPath();
    if (!serverPath) { reject(new Error('Next server file not found')); return; }

    const staticDir = getStaticDir();
    log('Starting Next server: ' + serverPath);
    log('Next cwd: ' + staticDir);

    // ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave like Node.js
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(NEXT_PORT),
      HOSTNAME: '127.0.0.1',
    };

    nextServer = spawn(process.execPath, [serverPath], {
      cwd: staticDir, env, stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    nextServer.stdout.on('data', (d) => { const t = d.toString().trim(); if(t) { log('[next] ' + t); output += t + '\n'; } });
    nextServer.stderr.on('data', (d) => { const t = d.toString().trim(); if(t) { log('[next err] ' + t); output += t + '\n'; } });
    nextServer.on('error', (err) => { log('Next process error: ' + err.message); reject(err); });
    nextServer.on('exit', (code) => { log('Next exit code: ' + code); if(code !== 0 && code !== null) reject(new Error('Exit ' + code + ': ' + output)); });

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      http.get('http://127.0.0.1:' + NEXT_PORT, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302) {
          clearInterval(interval); log('Next server ready!'); resolve();
        }
      }).on('error', () => {
        if (attempts >= 60) {
          clearInterval(interval);
          log('Next server failed after 60 attempts. Output: ' + output);
          reject(new Error('Next server failed to start.\nOutput: ' + output));
        }
      });
    }, 500);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 700,
    title: 'بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی',
    backgroundColor: '#010a05', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    icon: path.join(__dirname, 'icon.ico'),
  });
  mainWindow.once('ready-to-show', () => { mainWindow.show(); mainWindow.maximize(); });
  mainWindow.loadURL(NEXT_URL);
  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return {action:'allow'};
    shell.openExternal(url); return {action:'deny'};
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  log('Starting بانک رسانه...');
  log('App: ' + app.getAppPath());
  log('UserData: ' + app.getPath('userData'));
  log('Exec: ' + process.execPath);
  log('Resources: ' + process.resourcesPath);
  log('Version: ' + app.getVersion());

  try {
    await startApiService().catch(e => log('API service warning: ' + e.message));
    await startNextServer();
    createWindow();
  } catch(err) {
    log('FATAL: ' + err.message);
    dialog.showErrorBox('خطا در راه‌اندازی', 'خطا: ' + err.message + '\n\nفایل لاگ: ' + getLogPath());
    app.quit();
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  if (nextServer) { nextServer.kill('SIGTERM'); setTimeout(() => { if(nextServer) nextServer.kill('SIGKILL'); }, 3000); }
  if (apiServer)  { apiServer.kill('SIGTERM');  setTimeout(() => { if(apiServer)  apiServer.kill('SIGKILL');  }, 3000); }
});
