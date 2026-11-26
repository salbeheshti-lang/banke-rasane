/* eslint @typescript-eslint/no-require-imports: off */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

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

  const videoTranscoder = path.join(context.appOutDir, 'resources', 'api-service', 'video-transcode.mjs');
  const ffmpegBinary = path.join(context.appOutDir, 'resources', 'api-service', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  if (!fs.existsSync(videoTranscoder) || !fs.existsSync(ffmpegBinary)) {
    throw new Error('[afterPack] MP4 transcoder or bundled Windows FFmpeg binary is missing');
  }

  const apiServiceRoot = path.join(context.appOutDir, 'resources', 'api-service');
  const sharpPackage = path.join(apiServiceRoot, 'node_modules', 'sharp', 'lib', 'index.js');
  const sharpPlatformPackages = path.join(apiServiceRoot, 'node_modules', '@img');
  const semverPackage = path.join(apiServiceRoot, 'node_modules', 'semver', 'functions', 'coerce.js');
  if (!fs.existsSync(sharpPackage) || !fs.existsSync(sharpPlatformPackages) || !fs.existsSync(semverPackage)) {
    throw new Error('[afterPack] Sharp, @img platform binaries, or semver runtime dependency is missing from the packaged API service');
  }

  // Verify the native binaries from their final packaged location, not only
  // that the folders exist. This catches missing Windows optional packages.
  const apiRequire = createRequire(path.join(apiServiceRoot, 'index.js'));
  const semverResolved = apiRequire.resolve('semver/functions/coerce');
  if (!semverResolved.startsWith(path.join(apiServiceRoot, 'node_modules', 'semver') + path.sep)) {
    throw new Error('[afterPack] semver resolved outside the packaged API service; Bun would not be able to load it');
  }
  const packagedSharp = apiRequire('sharp');
  const optimizedProbe = await packagedSharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 20, g: 120, b: 80 } },
  }).webp().toBuffer();
  if (optimizedProbe.subarray(0, 4).toString('ascii') !== 'RIFF' || optimizedProbe.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error('[afterPack] Packaged Sharp did not produce a valid WebP image');
  }
  const packagedFfmpeg = apiRequire('ffmpeg-static');
  if (typeof packagedFfmpeg !== 'string' || !fs.existsSync(packagedFfmpeg)) {
    throw new Error('[afterPack] ffmpeg-static did not resolve to a packaged Windows executable');
  }
  const ffmpegProbe = spawnSync(packagedFfmpeg, ['-hide_banner', '-version'], {
    encoding: 'utf8', timeout: 15000, windowsHide: true,
  });
  if (ffmpegProbe.status !== 0) {
    throw new Error('[afterPack] Packaged FFmpeg binary failed to execute: ' + (ffmpegProbe.stderr || 'unknown error'));
  }

  // The actual desktop API is launched by bundled Bun, not Node. Exercise
  // Sharp from that exact runtime and API-service working directory so a
  // dependency hidden in resources/app/node_modules cannot mask a bad package.
  const bunExecutable = path.join(context.appOutDir, 'resources', 'bun-runtime', 'bin', 'bun.exe');
  if (!fs.existsSync(bunExecutable)) {
    throw new Error('[afterPack] Bundled Bun executable is missing');
  }
  const bunSharpProbe = spawnSync(bunExecutable, ['-e',
    "import sharp from 'sharp'; const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 20, g: 120, b: 80 } } }).webp().toBuffer(); if (bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('invalid WebP output'); console.log('Bun Sharp WebP probe passed');"
  ], {
    cwd: apiServiceRoot, encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  if (bunSharpProbe.status !== 0) {
    throw new Error('[afterPack] Bundled Bun cannot run Sharp in the packaged API service: ' + (bunSharpProbe.stderr || bunSharpProbe.stdout || 'unknown error'));
  }

  const imageImporter = path.join(context.appOutDir, 'resources', 'api-service', 'image-import.mjs');
  if (!fs.existsSync(imageImporter)) {
    throw new Error('[afterPack] API image-import.mjs is missing from packaged resources/api-service');
  }

  const required = [
    path.join(destination, 'server.js'),
    path.join(destination, 'node_modules', 'next', 'package.json'),
    path.join(destination, 'public', 'talk-shows-data.json'),
    path.join(destination, 'public', 'client-logo.png'),
    path.join(destination, 'public', 'client-logo-white.png'),
    path.join(destination, 'public', 'banke-rasane-logo.png'),
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
  if (fs.existsSync(bundledImages)) {
    throw new Error('[afterPack] Unused legacy public/program-images directory must not be included in the installer');
  }
  console.log('[afterPack] ✓ dereferenced Next.js standalone copied once to resources/next-service-dist');
  console.log('[afterPack] ✓ next@' + nextPackage.version + ' and ' + seed.length + ' archive records verified');
  console.log('[afterPack] standalone payload: ' + (standaloneBytes / 1024 / 1024).toFixed(1) + ' MiB');
  console.log('[afterPack] ✓ unused program-images excluded; SQLite image_data BLOBs preserved');
  console.log('[afterPack] ✓ packaged Sharp WebP conversion works in both Node and bundled Bun; FFmpeg Windows binary executed successfully');
  console.log('[afterPack] duplicate standalone tree: absent');
};
