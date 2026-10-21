// Electron Main Process for بانک رسانه - Optimized
const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';
const isProd = !isDev;

let mainWindow = null;
let nextServer = null;

// Get the path to bundled resources
function getResourcesPath() {
  return process.resourcesPath || path.join(__dirname, '..');
}

// Database path in user data directory
function getDbPath() {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, 'banke-rasane.db');
}

// Get the bundled seed database path (read-only template)
function getSeedDbPath() {
  const resources = getResourcesPath();
  // Try multiple possible locations
  const candidates = [
    path.join(resources, 'prisma', 'dev.db'),
    path.join(resources, 'app', 'prisma', 'dev.db'),
    path.join(__dirname, '..', 'prisma', 'dev.db'),
    path.join(__dirname, '..', '..', 'prisma', 'dev.db'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Initialize database - copy seed database if no user database exists
function initializeDatabase() {
  const dbPath = getDbPath();
  
  if (!fs.existsSync(dbPath)) {
    console.log('[db] First run - initializing database at:', dbPath);
    const seedPath = getSeedDbPath();
    
    if (seedPath && fs.existsSync(seedPath)) {
      console.log('[db] Copying seed database from:', seedPath);
      try {
        fs.copyFileSync(seedPath, dbPath);
        console.log('[db] Seed database copied successfully');
      } catch (e) {
        console.error('[db] Failed to copy seed:', e);
      }
    } else {
      console.log('[db] No seed database found - will create empty database');
      // Create empty database file (Prisma will create tables on first query)
      // Actually for SQLite, we need to create with proper schema
      // For now, copy whatever dev.db exists in the source
    }
  } else {
    console.log('[db] Database exists at:', dbPath);
  }
  
  // Set DATABASE_URL for Next.js server
  process.env.DATABASE_URL = `file:${dbPath}`;
}

// Start Next.js standalone server in production
function startNextServer() {
  return new Promise((resolve, reject) => {
    const resources = getResourcesPath();
    
    // Find the standalone directory
    const standaloneCandidates = [
      path.join(resources, '.next', 'standalone'),
      path.join(__dirname, '..', '.next', 'standalone'),
      path.join(__dirname, '..', '..', '.next', 'standalone'),
    ];
    
    let standalonePath = null;
    for (const p of standaloneCandidates) {
      if (fs.existsSync(p) && fs.existsSync(path.join(p, 'server.js'))) {
        standalonePath = p;
        break;
      }
    }
    
    if (!standalonePath) {
      console.error('[server] Standalone build not found');
      reject(new Error('Standalone build not found'));
      return;
    }
    
    console.log('[server] Starting Next.js standalone from:', standalonePath);
    
    const serverFile = path.join(standalonePath, 'server.js');
    
    nextServer = spawn(process.execPath, [serverFile], {
      env: {
        ...process.env,
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        ELECTRON_RUN_AS_NODE: undefined,
      },
      cwd: standalonePath,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    let resolved = false;
    
    nextServer.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log(`[next] ${msg.trim()}`);
      if (!resolved && (msg.includes('Ready') || msg.includes('started') || msg.includes('Local:'))) {
        resolved = true;
        resolve();
      }
    });
    
    nextServer.stderr.on('data', (data) => {
      console.error(`[next error] ${data.toString().trim()}`);
    });
    
    nextServer.on('error', (err) => {
      console.error('[server] Failed to start:', err);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
    
    nextServer.on('exit', (code) => {
      console.log(`[server] Process exited with code ${code}`);
    });
    
    // Fallback: resolve after timeout (server might already be running)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 5000);
  });
}

// Wait for server to be ready
async function waitForServer(url, maxRetries = 60) {
  const http = require('http');
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.destroy();
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

// Create main window
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: true,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    title: 'بانک رسانه',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
  });

  // Set up minimal menu
  const template = [
    {
      label: 'فایل',
      submenu: [
        { label: 'خروج', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'نمایش',
      submenu: [
        { role: 'reload', label: 'بارگذاری مجدد' },
        { role: 'togglefullscreen', label: 'تمام صفحه' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'بازنشانی بزرگنمایی' },
        { role: 'zoomIn', label: 'بزرگنمایی' },
        { role: 'zoomOut', label: 'کوچک‌نمایی' },
      ],
    },
    {
      label: 'کمک',
      submenu: [
        {
          label: 'درباره',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'درباره بانک رسانه',
              message: 'بانک رسانه نسخه 1.1.0',
              detail: 'نرم‌افزار مدیریت برنامه‌های تلویزیونی\n© 2026 salbeheshti-lang',
              buttons: ['بستن'],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  if (isDev) {
    await mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Start Next.js server in production
    try {
      await startNextServer();
      const ready = await waitForServer('http://127.0.0.1:3000', 60);
      if (!ready) {
        console.error('[app] Server did not become ready');
      }
      await mainWindow.loadURL('http://127.0.0.1:3000');
    } catch (e) {
      console.error('[app] Failed to start server:', e);
      // Show error page
      await mainWindow.loadURL('data:text/html,<h1>Failed to start server</h1><p>' + e.message + '</p>');
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(async () => {
  initializeDatabase();
  
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (nextServer) {
      try { nextServer.kill(); } catch (e) {}
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextServer) {
    try { nextServer.kill(); } catch (e) {}
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// IPC handlers
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:getDatabasePath', () => getDbPath());
ipcMain.handle('dialog:saveFile', async (event, options) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});
