/* eslint @typescript-eslint/no-require-imports: off */
const fs = require('node:fs');
const path = require('node:path');

function directorySizeBytes(directory) {
  if (!fs.existsSync(directory)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) total += directorySizeBytes(fullPath);
    else if (entry.isFile()) total += fs.statSync(fullPath).size;
  }
  return total;
}

module.exports = async function afterPack(context) {
  const source = path.resolve(process.cwd(), '.next', 'standalone');
  const destination = path.join(context.appOutDir, 'resources', 'next-service-dist');

  if (!fs.existsSync(path.join(source, 'server.js'))) {
    throw new Error('[afterPack] Next.js standalone server.js is missing from build output');
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    dereference: true,
    errorOnExist: false,
    preserveTimestamps: false,
  });

  // The standalone server must exist exactly once. The old packaging rules
  // accidentally copied .next/standalone into both app/ and next-service-dist.
  const duplicateStandalone = path.join(context.appOutDir, 'resources', 'app', '.next', 'standalone');
  if (fs.existsSync(duplicateStandalone)) {
    throw new Error('[afterPack] Duplicate .next/standalone detected under resources/app; refusing oversized installer');
  }

  const apiValidator = path.join(context.appOutDir, 'resources', 'api-service', 'video-validation.mjs');
  if (!fs.existsSync(apiValidator)) {
    throw new Error('[afterPack] Required API video-validation.mjs is missing from packaged resources/api-service');
  }

  const required = [
    path.join(destination, 'server.js'),
    path.join(destination, 'node_modules', 'next', 'package.json'),
    path.join(destination, 'public', 'talk-shows-data.json'),
  ];
  for (const file of required) {
    if (!fs.existsSync(file)) {
      throw new Error('[afterPack] Required standalone file missing after dereferenced copy: ' + file);
    }
  }

  const nextPackage = JSON.parse(fs.readFileSync(required[1], 'utf8'));
  const seed = JSON.parse(fs.readFileSync(required[2], 'utf8'));
  if (!Array.isArray(seed) || seed.length === 0) {
    throw new Error('[afterPack] Archive seed must be a non-empty JSON array');
  }

  const standaloneBytes = directorySizeBytes(destination);
  const bundledImages = path.join(destination, 'public', 'program-images');
  const bundledImageBytes = directorySizeBytes(bundledImages);
  console.log('[afterPack] ✓ dereferenced Next.js standalone copied once to resources/next-service-dist');
  console.log('[afterPack] ✓ next@' + nextPackage.version + ' and ' + seed.length + ' archive records verified');
  console.log('[afterPack] standalone payload: ' + (standaloneBytes / 1024 / 1024).toFixed(1) + ' MiB');
  console.log('[afterPack] program-images payload: ' + (bundledImageBytes / 1024 / 1024).toFixed(1) + ' MiB');
  console.log('[afterPack] duplicate standalone tree: absent');
};
