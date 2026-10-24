// Electron Main Process — بانک رسانه
// Spawns the Next.js standalone server and opens a BrowserWindow pointing to it.

const { app, BrowserWindow, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let nextServer = null;
const NEXT_PORT = 3000;
const NEXT_URL = `http://localhost:${NEXT_PORT}`;

// Path to the Next.js standalone server (built by `next build`)
function getNextServerPath() {
  // In production (packaged), the server lives in resources/next-service-dist
  const possiblePaths = [
    path.join(process.resourcesPath || '', 'next-service-dist', 'server.js'),
    path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
    path.join(__dirname, '..', 'next-service-dist', 'server.js'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  console.error('Next.js server not found in any of:', possiblePaths);
  return null;
}

// Path to the static files (public, .next/static)
function getStaticDir() {
  const possiblePaths = [
    path.join(process.resourcesPath || '', 'next-service-dist'),
    path.join(__dirname, '..', '.next', 'standalone'),
    path.join(__dirname, '..', 'next-service-dist'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'public'))) return p;
  }
  return possiblePaths[0];
}

// Start the Next.js standalone server
function startNextServer() {
  return new Promise((resolve, reject) => {
    const serverPath = getNextServerPath();
    if (!serverPath) {
      reject(new Error('Next.js server not found'));
      return;
    }

    const staticDir = getStaticDir();
    console.log('Starting Next.js server from:', serverPath);
    console.log('Static dir:', staticDir);

    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(NEXT_PORT),
      HOSTNAME: '0.0.0.0',
      DATABASE_URL: process.env.DATABASE_URL || `file:${path.join(staticDir, 'db', 'custom.db')}`,
    };

    nextServer = spawn(process.execPath, [serverPath], {
      cwd: staticDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    nextServer.stdout.on('data', (data) => {
      console.log(`[next] ${data.toString().trim()}`);
    });
    nextServer.stderr.on('data', (data) => {
      console.error(`[next] ${data.toString().trim()}`);
    });
    nextServer.on('error', (err) => {
      console.error('Failed to start Next.js server:', err);
      reject(err);
    });
    nextServer.on('exit', (code) => {
      console.log(`Next.js server exited with code ${code}`);
    });

    // Wait for the server to be ready
    let attempts = 0;
    const maxAttempts = 60;
    const checkInterval = setInterval(() => {
      attempts++;
      http.get(NEXT_URL, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302) {
          clearInterval(checkInterval);
          console.log(`Next.js server is ready at ${NEXT_URL}`);
          resolve();
        }
      }).on('error', () => {
        // Server not ready yet
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          reject(new Error('Next.js server failed to start within 30 seconds'));
        }
      });
    }, 500);
  });
}

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی',
    backgroundColor: '#010a05',
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: path.join(__dirname, 'icon.ico'),
  });

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  // Load the Next.js app
  mainWindow.loadURL(NEXT_URL);

  // Open external links in the default browser (not inside Electron)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.startsWith(NEXT_URL)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(NEXT_URL) && !url.startsWith('http://localhost')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Build the application menu
function buildMenu() {
  const template = [
    {
      label: 'فایل',
      submenu: [
        {
          label: 'خروج',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'نمایش',
      submenu: [
        { role: 'reload', label: 'بارگذاری مجدد' },
        { role: 'toggleDevTools', label: 'ابزار توسعه' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'بزرگنمایی پیش‌فرض' },
        { role: 'zoomIn', label: 'بزرگ‌نمایی' },
        { role: 'zoomOut', label: 'کوچک‌نمایی' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'تمام‌صفحه' },
      ],
    },
    {
      label: 'کمک',
      submenu: [
        {
          label: 'دربارهٔ بانک رسانه',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-about');
            }
          },
        },
        {
          label: 'گزارش مشکل',
          click: () => shell.openExternal('https://github.com/salbeheshti-lang/banke-rasane/issues'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(async () => {
  console.log('بانک رسانه در حال راه‌اندازی...');
  try {
    await startNextServer();
    createWindow();
    buildMenu();
  } catch (err) {
    console.error('Failed to start application:', err);
    // Show an error dialog and quit
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'خطا در راه‌اندازی بانک رسانه',
      `برنامه نتوانست سرور را راه‌اندازی کند.\n\nخطا: ${err.message}\n\nلطفاً با پشتیبانی تماس بگیرید.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On macOS, keep the app running
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up the Next.js server when quitting
app.on('before-quit', () => {
  if (nextServer) {
    console.log('Stopping Next.js server...');
    nextServer.kill('SIGTERM');
    // Force kill after 3 seconds
    setTimeout(() => {
      if (nextServer) {
        nextServer.kill('SIGKILL');
      }
    }, 3000);
  }
});

// Handle certificate errors (for development)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('http://localhost')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});
