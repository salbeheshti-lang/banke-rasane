// Electron Main Process — بانک رسانه
// Starts the Bun API service (port 3002) and the Next.js standalone server
// (port 3000), then opens a window pointed at the Next.js UI.
const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
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

// === Find the bundled Bun binary ===
function getBunPath() {
  // Check if bun is on PATH (dev mode)
  try {
    require('child_process').execSync('bun --version', { stdio: 'ignore' });
    return 'bun';
  } catch {}

  // Check bundled bun binary in resources
  const candidates = [
    path.join(process.resourcesPath || '', 'bun', process.platform === 'win32' ? 'bun.exe' : 'bun'),
    path.join(process.resourcesPath || '', 'bun-win-x64', 'bun.exe'),
    path.join(process.resourcesPath || '', 'bun', 'bun.exe'),
    path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'bun.exe' : 'bun'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      log('Found bundled Bun: ' + p);
      return p;
    }
  }
  log('Bun not found. API service will not start.');
  return null;
}

// === Locate the Next.js standalone server.js ===
function getNextServerPath() {
  const paths = [
    path.join(process.resourcesPath || '', 'next-service-dist', 'server.js'),
    path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) { log('Found Next server: ' + p); return p; }
  }
  log('Next server NOT FOUND.');
  return null;
}

function getStaticDir() {
  const paths = [
    path.join(process.resourcesPath || '', 'next-service-dist'),
    path.join(__dirname, '..', '.next', 'standalone'),
  ];
  for (const p of paths) {
    if (fs.existsSync(path.join(p, 'server.js'))) return p;
  }
  return paths[0];
}

// === Locate the API service ===
function getApiServicePath() {
  const paths = [
    path.join(process.resourcesPath || '', 'api-service', 'index.js'),
    path.join(__dirname, '..', 'mini-services', 'api-service', 'index.js'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) { log('Found API service: ' + p); return p; }
  }
  log('API service NOT FOUND.');
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

    const bunPath = getBunPath();
    if (!bunPath) { log('Bun not found — API service cannot start'); resolve(); return; }

    const apiDir = getApiStaticDir();
    const userData = app.getPath('userData');
    const dbDir = path.join(userData, 'db');
    const dbPath = path.join(dbDir, 'bankresaneh.sqlite');

    try { if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true }); } catch(e) {}

    // Copy bundled DB on first run
    const bundledDb = path.join(apiDir, 'bankresaneh.sqlite');
    if (!fs.existsSync(dbPath) && fs.existsSync(bundledDb)) {
      try { fs.copyFileSync(bundledDb, dbPath); log('Copied initial API db'); } catch(e) {}
    }

    log('Starting API service with: ' + bunPath + ' ' + apiPath);
    log('API cwd: ' + apiDir);
    log('API db: ' + dbPath);

    apiServer = spawn(bunPath, [apiPath], {
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

  // === Auto-updater ===
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    log('Update available: ' + info.version);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'به‌روزرسانی موجود است',
        message: `نسخه جدید ${info.version} در دسترس است.`,
        detail: 'آیا می‌خواهید هم‌اکنون دانلود کنید؟',
        buttons: ['دانلود و نصب', 'بعداً'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) { log('User accepted update download'); autoUpdater.downloadUpdate(); }
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    log('No update available (current: ' + app.getVersion() + ')');
  });

  autoUpdater.on('download-progress', (progress) => {
    log('Download progress: ' + Math.round(progress.percent) + '%');
    if (mainWindow) mainWindow.setProgressBar(progress.percent / 100);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log('Update downloaded: ' + info.version);
    if (mainWindow) mainWindow.setProgressBar(-1);
    dialog.showMessageBox(mainWindow, {
      type: 'info', title: 'آماده نصب',
      message: 'نسخه جدید دانلود شد.',
      detail: 'برنامه برای نصب مجدداً راه‌اندازی می‌شود.',
      buttons: ['نصب و راه‌اندازی مجدد'],
    }).then(() => { autoUpdater.quitAndInstall(); });
  });

  autoUpdater.on('error', (err) => {
    log('Auto-updater error: ' + err.message);
  });

  // Check for updates (non-blocking)
  try { autoUpdater.checkForUpdates().catch(err => log('Update check failed: ' + err.message)); }
  catch(e) { log('Update check skipped: ' + e.message); }

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

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { hasUpdate: !!result, version: result?.updateInfo?.version || null };
  } catch(e) { return { hasUpdate: false, error: e.message }; }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  if (nextServer) { nextServer.kill('SIGTERM'); setTimeout(() => { if(nextServer) nextServer.kill('SIGKILL'); }, 3000); }
  if (apiServer)  { apiServer.kill('SIGTERM');  setTimeout(() => { if(apiServer)  apiServer.kill('SIGKILL');  }, 3000); }
});
