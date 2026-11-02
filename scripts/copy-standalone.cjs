// Copy Next.js standalone runtime assets in a cross-platform way.
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const standaloneDir = path.join(root, '.next', 'standalone');
const staticDir = path.join(root, '.next', 'static');
const publicDir = path.join(root, 'public');

if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
  throw new Error('Next.js standalone output is missing: ' + path.join(standaloneDir, 'server.js'));
}
if (!fs.existsSync(staticDir)) {
  throw new Error('Next.js static assets are missing: ' + staticDir);
}

const standaloneNextDir = path.join(standaloneDir, '.next');
fs.mkdirSync(standaloneNextDir, { recursive: true });
fs.cpSync(staticDir, path.join(standaloneNextDir, 'static'), {
  recursive: true,
  force: true,
});

if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(standaloneDir, 'public'), {
    recursive: true,
    force: true,
  });
}

console.log('Next.js standalone assets copied successfully.');
