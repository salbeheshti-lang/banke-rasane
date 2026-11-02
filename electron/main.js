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
  // Prefer the exact runtime packaged with the application.
  const candidates = [
    path.join(process.resourcesPath || '', 'bun-runtime', 'bin', 'bun.exe'),
    path.join(process.resourcesPath || '', 'bun', process.platform === 'win32' ? 'bun.exe' : 'bun'),
    path.join(process.resourcesPath || '', 'bun-win-x64', 'bun.exe'),
    path.join(__dirname, '..', 'node_modules', '@oven', 'bun-windows-x64', 'bin', 'bun.exe'),
    path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'bun.exe' : 'bun'),
    path.join(__dirname, 'bun', 'bun.exe'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      log('Found bundled Bun: ' + candidate);
      return candidate;
    }
  }
  // Allow PATH-based Bun only in development.
  if (!app.isPackaged) {
    try {
      require('child_process').execSync('bun --version', { stdio: 'ignore' });
      return 'bun';
    } catch {}
  }
  log('Bun runtime not found.');
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
function waitForHttp(url, child, label, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let settled = false;
    let interval = null;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (interval) clearInterval(interval);
      if (error) reject(error);
      else resolve();
    };
    child.once('error', (error) => finish(new Error(label + ' process error: ' + error.message)));
    child.once('exit', (code, signal) => {
      if (!settled) finish(new Error(label + ' exited before readiness (code ' + code + ', signal ' + signal + ')'));
    });
    const probe = () => {
      if (settled) return;
      attempts++;
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode >= 200 && response.statusCode < 400) {
          log(label + ' ready (HTTP ' + response.statusCode + ')');
          finish();
        } else if (attempts >= maxAttempts) {
          finish(new Error(label + ' returned HTTP ' + response.statusCode));
        }
      });
      request.setTimeout(2000, () => request.destroy(new Error('Readiness probe timed out')));
      request.on('error', () => {
        if (attempts >= maxAttempts) finish(new Error(label + ' failed after ' + maxAttempts + ' attempts'));
      });
    };
    interval = setInterval(probe, 500);
    probe();
  });
}

// === Start the API service (Bun on port 3002) ===
async function startApiService() {
  const apiPath = getApiServicePath();
  const bunPath = getBunPath();
  if (!apiPath) throw new Error('API service file not found');
  if (!bunPath) throw new Error('Bun runtime not found. The installer must include bun-runtime/bin/bun.exe');

  const apiDir = getApiStaticDir();
  const userData = app.getPath('userData');
  const dbDir = path.join(userData, 'db');
  const dbPath = path.join(dbDir, 'bankresaneh.sqlite');
  fs.mkdirSync(dbDir, { recursive: true });

  // Seed the writable user database once. The tracked DB uses WAL mode, so
  // its WAL sidecar must accompany the main file to preserve committed rows.
  const bundledDb = path.join(apiDir, 'bankresaneh.sqlite');
  if (!fs.existsSync(dbPath) && fs.existsSync(bundledDb)) {
    fs.copyFileSync(bundledDb, dbPath);
    const bundledWal = bundledDb + '-wal';
    if (fs.existsSync(bundledWal)) fs.copyFileSync(bundledWal, dbPath + '-wal');
    log('Copied initial API database (including WAL when present)');
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
      HOSTNAME: '127.0.0.1',
      DB_PATH: dbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  apiServer.stdout.on('data', (data) => { const value = data.toString().trim(); if (value) log('[api] ' + value); });
  apiServer.stderr.on('data', (data) => { const value = data.toString().trim(); if (value) log('[api:err] ' + value); });
  await waitForHttp('http://127.0.0.1:' + API_PORT + '/api/health', apiServer, 'API service');
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
      cwd: staticDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let output = '';
    nextServer.stdout.on('data', (data) => {
      const value = data.toString().trim();
      if (value) { log('[next] ' + value); output += value + '\n'; }
    });
    nextServer.stderr.on('data', (data) => {
      const value = data.toString().trim();
      if (value) { log('[next:err] ' + value); output += value + '\n'; }
    });
    waitForHttp('http://127.0.0.1:' + NEXT_PORT, nextServer, 'Next.js server')
      .then(resolve)
      .catch((error) => reject(new Error(error.message + '\nOutput: ' + output)));
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
  // Rotate the previous run's log before recording this startup.
  try {
    const logPath = getLogPath();
    if (fs.existsSync(logPath)) {
      fs.copyFileSync(logPath, logPath + '.prev');
      fs.writeFileSync(logPath, '');
    }
  } catch (error) {}
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
  for (const child of [apiServer, nextServer]) {
    if (child && child.exitCode === null) child.kill();
  }
});
