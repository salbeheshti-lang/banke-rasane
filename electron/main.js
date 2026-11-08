/* eslint @typescript-eslint/no-require-imports: off */
// Electron Main Process — بانک رسانه
// Starts the Bun API service (port 3002) and the Next.js standalone server
// (port 3000), then opens a window pointed at the Next.js UI.
const { app, BrowserWindow, shell, dialog, ipcMain, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { randomBytes } = require('crypto');

function toPrismaSqliteUrl(filePath) {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  return `file:${normalized}`;
}

let mainWindow = null;
let nextServer = null;
let manualUpdateCheck = false;
let apiServer = null;
const NEXT_PORT = 3000;
const API_PORT = 3002;
const NEXT_URL = `http://127.0.0.1:${NEXT_PORT}`;
const STARTUP_TOKEN = randomBytes(32).toString('hex');

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
    // Canonical packaged location: the standalone tree is copied once by extraResources.
    path.join(process.resourcesPath || '', 'next-service-dist', 'server.js'),
    // Development fallback only.
    path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) { log('Found Next server: ' + p); return p; }
  }
  log('Next server NOT FOUND.');
  return null;
}

function getStaticDir() {
  // Return the directory containing server.js — used as cwd for the server process.
  const serverPath = getNextServerPath();
  if (serverPath) return path.dirname(serverPath);
  // Fallback to the first candidate
  return path.join(process.resourcesPath || '', 'next-service-dist');
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

// Wait for an HTTP endpoint to return a 2xx/3xx response.
//
// Uses a deadline-based approach (mirrors scripts/smoke-electron.cjs) so that
// "connection refused" — i.e. the server is still cold-starting — is retried
// without consuming a fixed budget of attempts. This is critical for the
// Next.js standalone server, which on slower Windows machines (antivirus,
// HDD, first-run module load) can take 60+ seconds to print its banner and
// become ready.
//
// Real failures are detected separately:
//   - child process exits before readiness  → reject immediately
//   - total elapsed time exceeds timeoutMs  → reject
//
// opts:
//   intervalMs       — probe cadence (default 500ms)
//   timeoutMs        — total deadline (default 90s; Next.js gets 180s)
//   probeTimeoutMs   — per-request socket timeout (default 2s)
//   progressEveryMs  — log "still starting" progress every N ms (default 10s)
//   headers          — request headers
function waitForHttp(url, child, label, opts = {}) {
  const {
    intervalMs = 500,
    timeoutMs = 90 * 1000,
    probeTimeoutMs = 2000,
    progressEveryMs = 10 * 1000,
    headers = {},
  } = opts;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    let lastProgressLog = 0;
    const startedAt = Date.now();
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (timer) clearInterval(timer);
      if (error) reject(error);
      else resolve();
    };
    // Real failure: child died before we ever got a successful response.
    child.once('error', (error) => finish(new Error(label + ' process error: ' + error.message)));
    child.once('exit', (code, signal) => {
      if (!settled) finish(new Error(label + ' exited before readiness (code ' + code + ', signal ' + signal + ')'));
    });
    const probe = () => {
      if (settled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed > timeoutMs) {
        finish(new Error(label + ' not ready after ' + Math.round(elapsed / 1000) + 's'));
        return;
      }
      if (elapsed - lastProgressLog >= progressEveryMs) {
        log(label + ' still starting... (' + Math.round(elapsed / 1000) + 's elapsed)');
        lastProgressLog = elapsed;
      }
      const request = http.get(url, { headers }, (response) => {
        response.resume();
        if (response.statusCode >= 200 && response.statusCode < 400) {
          log(label + ' ready (HTTP ' + response.statusCode + ', ' + Math.round(elapsed / 1000) + 's)');
          finish();
        }
        // Non-2xx/3xx: keep probing until the deadline.
      });
      request.setTimeout(probeTimeoutMs, () => request.destroy());
      request.on('error', () => { /* will retry on next interval */ });
    };
    timer = setInterval(probe, intervalMs);
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

  // Seed path: look in the same directory as the Next.js server (wherever it
  // was found — could be resources/next-service-dist or resources/app/.next/standalone).
  // Fallback to the old hardcoded path.
  const nextServerDir = getStaticDir();
  const seedCandidates = [
    path.join(nextServerDir, 'public', 'talk-shows-data.json'),
    path.join(process.resourcesPath || '', 'next-service-dist', 'public', 'talk-shows-data.json'),
    path.join(process.resourcesPath || '', 'app', '.next', 'standalone', 'public', 'talk-shows-data.json'),
  ];
  let seedPath = seedCandidates[1]; // fallback
  for (const sp of seedCandidates) {
    if (fs.existsSync(sp)) { seedPath = sp; break; }
  }
  if (!fs.existsSync(seedPath)) {
    log('WARNING: Seed file not found at any candidate path — first-run DB seeding will be skipped.');
    log('  Checked: ' + seedCandidates.join('; '));
  } else {
    log('Seed path: ' + seedPath);
  }
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
      BANKRESANEH_HOST: '127.0.0.1',
      DB_PATH: dbPath,
      BANKRESANEH_SEED_PATH: seedPath,
      BANKRESANEH_STARTUP_TOKEN: STARTUP_TOKEN,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  apiServer.stdout.on('data', (data) => { const value = data.toString().trim(); if (value) log('[api] ' + value); });
  apiServer.stderr.on('data', (data) => { const value = data.toString().trim(); if (value) log('[api:err] ' + value); });
  await waitForHttp('http://127.0.0.1:' + API_PORT + '/api/internal/ready', apiServer, 'API service', {
    headers: { 'x-bankresaneh-startup-token': STARTUP_TOKEN },
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

    const userDataDir = app.getPath('userData');
    const prismaDataDir = path.join(userDataDir, 'db');
    fs.mkdirSync(prismaDataDir, { recursive: true });
    const prismaDbPath = path.join(prismaDataDir, 'translation-rate-limit.sqlite');

    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(NEXT_PORT),
      HOSTNAME: '127.0.0.1',
      BANKRESANEH_STARTUP_TOKEN: STARTUP_TOKEN,
      // Pass the user-data directory so Next.js API routes (like the
      // translate endpoint's rate-limit file) can write to a writable
      // location instead of the (potentially read-only) install dir.
      BANKRESANEH_DATA_DIR: userDataDir,
      // Prisma's translation rate-limit database lives in the writable user-data directory.
      DATABASE_URL: toPrismaSqliteUrl(prismaDbPath),
      // Also pass the API base URL so the translate endpoint knows where
      // to proxy auth checks (otherwise it defaults to localhost:3002
      // which is correct in dev but explicit is better).
      BANKRESANEH_API_BASE: 'http://127.0.0.1:' + API_PORT,
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
    waitForHttp('http://127.0.0.1:' + NEXT_PORT + '/api/internal/ready', nextServer, 'Next.js server', {
      // Next.js standalone cold-start on Windows can be slow (antivirus,
      // HDD, first-time module load). Allow a generous 180s budget so the
      // launcher doesn't declare FATAL while the server is still booting.
      timeoutMs: 180 * 1000,
      headers: { 'x-bankresaneh-startup-token': STARTUP_TOKEN },
    })
      .then(resolve)
      .catch((error) => reject(new Error(error.message + '\nOutput: ' + output)));
  });
}


async function checkForUpdatesManually() {
  if (!app.isPackaged) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'بررسی به‌روزرسانی',
      message: 'بررسی نسخهٔ جدید فقط در نسخهٔ نصب‌شده امکان‌پذیر است.',
    });
    return;
  }
  if (manualUpdateCheck) return;
  manualUpdateCheck = true;
  log('Manual update check requested');
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    manualUpdateCheck = false;
    log('Manual update check failed: ' + error.message);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'خطا در بررسی به‌روزرسانی',
      message: 'اتصال به سرویس به‌روزرسانی برقرار نشد.',
      detail: error.message,
    });
  }
}

function installApplicationMenu() {
  const template = [
    { label: 'فایل', submenu: [{ role: 'quit', label: 'خروج' }] },
    {
      label: 'ویرایش',
      submenu: [
        { role: 'undo', label: 'واگرد' },
        { role: 'redo', label: 'ازنو' },
        { type: 'separator' },
        { role: 'cut', label: 'برش' },
        { role: 'copy', label: 'رونوشت' },
        { role: 'paste', label: 'جای‌گذاری' },
        { role: 'selectAll', label: 'انتخاب همه' },
      ],
    },
    {
      label: 'ویندوز',
      submenu: [
        { label: 'بررسی به‌روزرسانی', click: () => { void checkForUpdatesManually(); } },
        { type: 'separator' },
        { role: 'minimize', label: 'کوچک‌کردن پنجره' },
        { role: 'close', label: 'بستن پنجره' },
      ],
    },
    {
      label: 'راهنما',
      submenu: [{
        label: 'دربارهٔ بانک رسانه',
        click: () => dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'بانک رسانه',
          message: 'بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی',
          detail: 'نسخهٔ ' + app.getVersion(),
        }),
      }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 700,
    title: 'بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی',
    backgroundColor: '#010a05', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    icon: path.join(__dirname, 'icon.ico'),
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });
  mainWindow.loadURL(NEXT_URL);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      log('Blocked malformed window-open URL');
      return { action: 'deny' };
    }

    // Only the exact local Next.js origin may open inside the app.
    // Avoid startsWith checks: they also accept attacker hosts such as
    // http://127.0.0.1.evil.example.
    const isLocalApp = target.protocol === 'http:' &&
      (target.hostname === '127.0.0.1' || target.hostname === 'localhost') &&
      target.port === String(NEXT_PORT);
    if (isLocalApp) return { action: 'allow' };

    // External windows may only launch ordinary web URLs. Never pass file:,
    // javascript:, data:, or arbitrary custom protocols to the OS handler.
    if (target.protocol === 'https:' || target.protocol === 'http:') {
      shell.openExternal(target.toString()).catch((error) => {
        log('Could not open external URL: ' + error.message);
      });
    } else {
      log('Blocked unsupported external URL protocol: ' + target.protocol);
    }
    return { action: 'deny' };
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
    manualUpdateCheck = false;
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
    if (manualUpdateCheck && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'بررسی به‌روزرسانی',
        message: 'برنامه به‌روز است.',
        detail: 'نسخهٔ فعلی: ' + app.getVersion(),
      });
    }
    manualUpdateCheck = false;
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
    if (manualUpdateCheck && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'خطا در بررسی به‌روزرسانی',
        message: 'بررسی نسخهٔ جدید با خطا مواجه شد.',
        detail: err.message,
      });
    }
    manualUpdateCheck = false;
  });

  try {
    await startApiService();
    await startNextServer();
    createWindow();
    installApplicationMenu();
    // Run one automatic check after the window and native menu are ready.
    try { autoUpdater.checkForUpdates().catch(err => log('Update check failed: ' + err.message)); }
    catch(e) { log('Update check skipped: ' + e.message); }
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
