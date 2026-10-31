// Cross-platform copy of .next/static and public into .next/standalone
// (replaces `cp -r` which fails on Windows Git Bash)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-standalone] source not found, skipping: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(s, d);
    } else if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(s);
      try { fs.symlinkSync(target, d); } catch (e) { /* ignore */ }
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

console.log('[copy-standalone] copying .next/static → .next/standalone/.next/static');
copyRecursive(
  path.join(root, '.next', 'static'),
  path.join(root, '.next', 'standalone', '.next', 'static'),
);

console.log('[copy-standalone] copying public → .next/standalone/public');
copyRecursive(
  path.join(root, 'public'),
  path.join(root, '.next', 'standalone', 'public'),
);

console.log('[copy-standalone] done.');
