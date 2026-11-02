/* eslint @typescript-eslint/no-require-imports: off */
// Cross-platform copy of .next/static, public, and node_modules/next into .next/standalone
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

console.log('[copy-standalone] copying .next/static → .next/standalone/.next/static');
copyRecursive(path.join(root, '.next', 'static'), path.join(root, '.next', 'standalone', '.next', 'static'));

console.log('[copy-standalone] copying public → .next/standalone/public');
copyRecursive(path.join(root, 'public'), path.join(root, '.next', 'standalone', 'public'));

// CRITICAL: Next.js 16 with Turbopack doesn't create node_modules in standalone.
// The standalone server.js requires('next') so we must copy it manually.
const nextSrc = path.join(root, 'node_modules', 'next');
const nextDest = path.join(root, '.next', 'standalone', 'node_modules', 'next');
if (fs.existsSync(nextSrc) && !fs.existsSync(nextDest)) {
  console.log('[copy-standalone] copying node_modules/next → standalone (required by server.js)');
  copyRecursive(nextSrc, nextDest);
} else if (fs.existsSync(nextDest)) {
  console.log('[copy-standalone] node_modules/next already exists in standalone');
} else {
  console.log('[copy-standalone] WARNING: node_modules/next not found — server.js will fail!');
}

// Also copy react and react-dom since they're needed
for (const mod of ['react', 'react-dom']) {
  const src = path.join(root, 'node_modules', mod);
  const dest = path.join(root, '.next', 'standalone', 'node_modules', mod);
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    console.log(`[copy-standalone] copying node_modules/${mod} → standalone`);
    copyRecursive(src, dest);
  }
}

console.log('[copy-standalone] done.');
