// Cross-platform launcher for the Next.js standalone server.
const { spawn } = require('node:child_process');
const path = require('node:path');

const serverPath = path.resolve(__dirname, '..', '.next', 'standalone', 'server.js');
const child = spawn(process.execPath, [serverPath], {
  cwd: path.dirname(serverPath),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '3000',
    HOSTNAME: process.env.HOSTNAME || '127.0.0.1',
  },
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (error) => {
  console.error('[standalone] failed to start:', error.message);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) console.error('[standalone] exited from signal:', signal);
  process.exitCode = code ?? (signal ? 1 : 0);
});
