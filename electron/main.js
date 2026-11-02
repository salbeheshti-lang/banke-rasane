// Electron Main Process — بانک رسانه
const { app, BrowserWindow, shell, dialog } = require('electron');
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
const API_URL = `http://127.0.0.1:${API_PORT}/api/health`;

function getLogPath() {
  return path.join(app.getPath('userData'), 'bankresaneh.log');
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  try { fs.appendFileSync(getLogPath(), line); } catch(e) {}
}

function getNextServerPath() {
  const paths = [
    path.join(process.resourcesPath || '', 'next-service-dist', 'server.js'),
    path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
    path.join(__dirname, '..', 'next-service-dist', 'server.js'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) { log('Found server: ' + p); return p; }
  }
  log('Server NOT FOUND. Paths checked: ' + JSON.stringify(paths));
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

function getApiServerPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'api-service', 'index.js'),
    path.join(__dirname, '..', 'mini-services', 'api-service', 'index.js'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function getBunExecutable() {
  const candidates = [
    path.join(process.resourcesPath || '', 'bun-runtime', 'bin', 'bun.exe'),
    path.join(process.resourcesPath || '', 'bun-runtime', 'bun.exe'),
    path.join(process.resourcesPath || '', 'bun', 'bun.exe'),
    path.join(__dirname, '..', 'node_modules', '@oven', 'bun-windows-x64', 'bin', 'bun.exe'),
    path.join(__dirname, 'bun', 'bun.exe'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function waitForHttp(url, child, label, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let settled = false;
    let interval = null;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (interval) clearInterval(interval);
      if (err) reject(err);
      else resolve();
    };
    child.once('error', (err) => finish(new Error(label + ' process error: ' + err.message)));
    child.once('exit', (code, signal) => {
      if (!settled) finish(new Error(label + ' exited before readiness (code ' + code + ', signal ' + signal + ')'));
    });
    const probe = () => {
      if (settled) return;
      attempts++;
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 400) {
          log(label + ' ready (HTTP ' + res.statusCode + ')');
          finish();
        } else if (attempts >= maxAttempts) {
          finish(new Error(label + ' returned HTTP ' + res.statusCode));
        }
      });
      req.setTimeout(2000, () => req.destroy(new Error('Readiness probe timed out')));
      req.on('error', () => {
        if (attempts >= maxAttempts) finish(new Error(label + ' did not become ready after ' + maxAttempts + ' attempts'));
      });
    };
    interval = setInterval(probe, 500);
    probe();
  });
}

async function startApiServer() {
  const apiPath = getApiServerPath();
  const bunPath = getBunExecutable();
  if (!apiPath) throw new Error('API service file not found');
  if (!bunPath) throw new Error('Bundled Bun runtime not found. Expected bun-runtime/bin/bun.exe');

  const userData = app.getPath('userData');
  const apiDataDir = path.join(userData, 'api-service');
  fs.mkdirSync(apiDataDir, { recursive: true });
  const dbPath = path.join(apiDataDir, 'bankresaneh.sqlite');
  const bundledDb = path.join(process.resourcesPath || '', 'api-service', 'bankresaneh.sqlite');
  if (!fs.existsSync(dbPath) && fs.existsSync(bundledDb)) {
    fs.copyFileSync(bundledDb, dbPath);
    const bundledWal = bundledDb + '-wal';
    if (fs.existsSync(bundledWal)) {
      fs.copyFileSync(bundledWal, dbPath + '-wal');
    }
    log('Copied initial API database and WAL to user data');
  }

  const standaloneDir = path.join(process.resourcesPath || '', 'next-service-dist');
  const seedPath = path.join(standaloneDir, 'public', 'talk-shows-data.json');
  const env = {
    ...process.env,
    PORT: String(API_PORT),
    HOSTNAME: '127.0.0.1',
    BANKRESANEH_DB_PATH: dbPath,
    BANKRESANEH_SEED_PATH: seedPath,
  };
  log('Starting API service: ' + apiPath);
  log('API database: ' + dbPath);
  apiServer = spawn(bunPath, [apiPath], {
    cwd: apiDataDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  apiServer.stdout.on('data', (d) => { const value = d.toString().trim(); if (value) log('[api] ' + value); });
  apiServer.stderr.on('data', (d) => { const value = d.toString().trim(); if (value) log('[api:err] ' + value); });
  await waitForHttp(API_URL, apiServer, 'API service');
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    const serverPath = getNextServerPath();
    if (!serverPath) { reject(new Error('Server file not found')); return; }

    const staticDir = getStaticDir();
    const userData = app.getPath('userData');
    const dbDir = path.join(userData, 'db');
    const dbPath = path.join(dbDir, 'custom.db');

    try {
      if (!fs.existsSync(dbDir)) { fs.mkdirSync(dbDir, {recursive: true}); log('Created db dir: ' + dbDir); }
    } catch(e) { log('Error creating db dir: ' + e.message); }

    // Copy initial database if exists
    const bundledDb = path.join(staticDir, 'db', 'custom.db');
    if (!fs.existsSync(dbPath) && fs.existsSync(bundledDb)) {
      try { fs.copyFileSync(bundledDb, dbPath); log('Copied initial db'); } catch(e) { log('Could not copy db: ' + e.message); }
    }

    log('Starting server: ' + serverPath);
    log('cwd: ' + staticDir);
    log('db: ' + dbPath);

    // CRITICAL FIX: ELECTRON_RUN_AS_NODE=1 makes the Electron binary
    // behave like a regular Node.js binary. Without this, spawning
    // process.execPath (BankResaneh.exe) with server.js as argument
    // causes Electron to load main.js again instead of running server.js,
    // creating an infinite recursive loop.
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(NEXT_PORT),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: 'file:' + dbPath,
      // Prevent Electron from trying to load any UI
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    };

    // Use process.execPath (the Electron binary) but with ELECTRON_RUN_AS_NODE=1
    // which makes it act as plain Node.js
    nextServer = spawn(process.execPath, [serverPath], { cwd: staticDir, env, stdio: ['ignore','pipe','pipe'] });

    let output = '';
    nextServer.stdout.on('data', (d) => { const value = d.toString().trim(); if (value) { log('[server] ' + value); output += value + '\n'; } });
    nextServer.stderr.on('data', (d) => { const value = d.toString().trim(); if (value) { log('[server:err] ' + value); output += value + '\n'; } });
    waitForHttp(NEXT_URL, nextServer, 'Next.js server')
      .then(resolve)
      .catch((err) => reject(new Error(err.message + '\nOutput: ' + output)));
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
  // Rotate the previous startup log before writing messages for this run.
  try {
    const logPath = getLogPath();
    if (fs.existsSync(logPath)) {
      fs.copyFileSync(logPath, logPath + '.prev');
      fs.writeFileSync(logPath, '');
    }
  } catch (e) {}

  log('Starting بانک رسانه...');
  log('App: ' + app.getAppPath());
  log('UserData: ' + app.getPath('userData'));
  log('Exec: ' + process.execPath);
  log('Resources: ' + process.resourcesPath);


  // Debug: list resource files
  try {
    const rp = process.resourcesPath;
    if (rp && fs.existsSync(rp)) {
      log('Resources: ' + fs.readdirSync(rp).join(', '));
      const nsd = path.join(rp, 'next-service-dist');
      if (fs.existsSync(nsd)) log('next-service-dist: ' + fs.readdirSync(nsd).join(', '));
    }
  } catch(e) { log('Debug error: ' + e.message); }

  try {
    await startApiServer();
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
  for (const child of [apiServer, nextServer]) {
    if (child && !child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => {
    for (const child of [apiServer, nextServer]) {
      if (child && child.exitCode === null) child.kill('SIGKILL');
    }
  }, 3000).unref?.();
});
