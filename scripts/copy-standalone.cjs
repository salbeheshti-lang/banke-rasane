/* eslint @typescript-eslint/no-require-imports: off */
// Cross-platform copy of .next/static, public, and node_modules into .next/standalone
// CRITICAL: Must handle symbolic links (symlinks/junctions) properly.
// The old version used readdirSync + isDirectory/isFile which SILENTLY SKIPS
// symlinks — causing "Cannot find module 'next'" on Windows.
// This version uses fs.cpSync (Node 16.7+) which resolves symlinks correctly.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

/**
 * Copy a directory tree recursively, following symlinks.
 * Uses fs.cpSync which properly resolves symbolic links on all platforms.
 */
function copyTree(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('[copy-standalone] WARNING: source does not exist: ' + src);
    return false;
  }
  // fs.cpSync with recursive:true follows symlinks and copies real content.
  // force:true overwrites existing files (idempotent re-runs).
  // dereference:true resolves symlinks to their targets (critical for Windows).
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    dereference: true,
    errorOnExist: false,
    preserveTimestamps: false,
  });
  return true;
}

console.log('[copy-standalone] copying .next/static → .next/standalone/.next/static');
copyTree(
  path.join(root, '.next', 'static'),
  path.join(root, '.next', 'standalone', '.next', 'static')
);

console.log('[copy-standalone] copying public → .next/standalone/public');
copyTree(
  path.join(root, 'public'),
  path.join(root, '.next', 'standalone', 'public')
);

// === Verify that standalone/node_modules exists and has 'next' ===
const standaloneNodeModules = path.join(root, '.next', 'standalone', 'node_modules');
const standaloneNext = path.join(standaloneNodeModules, 'next');

if (!fs.existsSync(standaloneNext)) {
  console.log('[copy-standalone] node_modules/next missing in standalone — copying from root...');
  const rootNext = path.join(root, 'node_modules', 'next');
  if (fs.existsSync(rootNext)) {
    copyTree(rootNext, standaloneNext);
    console.log('[copy-standalone] ✓ node_modules/next copied');
  } else {
    console.error('[copy-standalone] FATAL: node_modules/next not found in root either!');
    console.error('[copy-standalone] server.js will fail with "Cannot find module next"');
  }
} else {
  console.log('[copy-standalone] ✓ node_modules/next already present in standalone');
}

// === Also ensure react, react-dom, and other critical deps are present ===
// Next.js standalone should include these, but on some platforms/builds they
// might be missing or only present as symlinks. Copy from root if absent.
const criticalDeps = ['react', 'react-dom', 'styled-jsx', 'sharp', 'semver', 'client-only'];
for (const mod of criticalDeps) {
  const dest = path.join(standaloneNodeModules, mod);
  if (!fs.existsSync(dest)) {
    const src = path.join(root, 'node_modules', mod);
    if (fs.existsSync(src)) {
      console.log(`[copy-standalone] copying node_modules/${mod} → standalone`);
      copyTree(src, dest);
    }
  }
}

// === Verify the standalone server.js can find 'next' ===
const serverJs = path.join(root, '.next', 'standalone', 'server.js');
if (fs.existsSync(serverJs)) {
  const nextPackageJson = path.join(standaloneNext, 'package.json');
  if (fs.existsSync(nextPackageJson)) {
    const pkg = JSON.parse(fs.readFileSync(nextPackageJson, 'utf-8'));
    console.log(`[copy-standalone] ✓ verified: next@${pkg.version} is present in standalone`);
  } else {
    console.error('[copy-standalone] WARNING: next/package.json not found — module may be incomplete');
  }
} else {
  console.error('[copy-standalone] WARNING: server.js not found in standalone');
}

// === Also copy the @next and @swc scoped packages if missing ===
// These are required by Next.js at runtime but might be symlinked.
for (const scope of ['@next', '@swc']) {
  const dest = path.join(standaloneNodeModules, scope);
  const src = path.join(root, 'node_modules', scope);
  if (!fs.existsSync(dest) && fs.existsSync(src)) {
    console.log(`[copy-standalone] copying node_modules/${scope} → standalone`);
    copyTree(src, dest);
  }
}

console.log('[copy-standalone] done.');
