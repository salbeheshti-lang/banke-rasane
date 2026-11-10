/* eslint @typescript-eslint/no-require-imports: off */
const fs = require('node:fs');
const path = require('node:path');

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

  console.log('[afterPack] ✓ dereferenced Next.js standalone copied once to resources/next-service-dist');
  console.log('[afterPack] ✓ next@' + nextPackage.version + ' and ' + seed.length + ' archive records verified');
};
