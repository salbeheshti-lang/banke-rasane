// Electron Main Process — بانک رسانه
const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let nextServer = null;
const NEXT_PORT = 3000;
const NEXT_URL = `http://127.0.0.1:${NEXT_PORT}`;

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
    let settled = false;
    let attempts = 0;
    let interval = null;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (interval) clearInterval(interval);
      if (err) reject(err);
      else resolve();
    };

    nextServer.stdout.on('data', (d) => {
      const t = d.toString().trim();
      if (t) { log('[server] ' + t); output += t + '\\n'; }
    });
    nextServer.stderr.on('data', (d) => {
      const t = d.toString().trim();
      if (t) { log('[err] ' + t); output += t + '\\n'; }
    });
    nextServer.on('error', (err) => {
      log('Process error: ' + err.message);
      finish(err);
    });
    nextServer.on('exit', (code, signal) => {
      log('Server exit code: ' + code + ', signal: ' + signal);
      if (!settled) finish(new Error('Next.js server exited before becoming ready (code ' + code + ', signal ' + signal + ').\\nOutput: ' + output));
    });

    const probe = () => {
      if (settled) return;
      attempts++;
      const request = http.get(NEXT_URL, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 400) {
          log('Server ready (HTTP ' + res.statusCode + ')');
          finish();
        } else if (attempts >= 60) {
          finish(new Error('Next.js returned HTTP ' + res.statusCode + ' during startup.\\nOutput: ' + output));
        }
      });
      request.setTimeout(2000, () => request.destroy(new Error('Startup probe timed out')));
      request.on('error', () => {
        if (attempts >= 60) {
          log('Server failed after 60 attempts. Output: ' + output);
          finish(new Error('Next.js server failed to start.\\nOutput: ' + output));
        }
      });
    };

    interval = setInterval(probe, 500);
    probe();
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
    await startNextServer();
    createWindow();
  } catch(err) {
    log('FATAL: ' + err.message);
    dialog.showErrorBox('خطا در راه‌اندازی', 'خطا: ' + err.message + '\n\nفایل لاگ: ' + getLogPath());
    app.quit();
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (nextServer) { nextServer.kill('SIGTERM'); setTimeout(() => { if(nextServer) nextServer.kill('SIGKILL'); }, 3000); } });
