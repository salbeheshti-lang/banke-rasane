/* eslint-disable @typescript-eslint/no-require-imports */
// Optimize client-logo.png:
// 1. Remove solid black background (flood-fill from corners -> transparent)
//    without removing the logo's own black outlines (which are interior).
// 2. Trim/crop tight to the visible logo content.
// 3. Resize to a reasonable max dimension (keeps aspect ratio).
// 4. Export as PNG RGBA (true alpha, not palette-based).
const sharp = require('sharp');
const fs = require('fs');

const SRC = 'public/client-logo.png';
const OUT = 'public/client-logo.png';
const OUT_SM = 'public/client-logo-sm.png';

(async () => {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  console.log(`input: ${width}x${height} channels=${channels}`);

  const idx = (x, y) => (y * width + x) * channels;

  // Flood-fill from all 4 corners: mark connected BLACK-ish pixels (R<24,G<24,B<24)
  // as background. Use a queue-based BFS so we only remove the OUTER black field,
  // not black outlines that sit inside the logo.
  const bgThreshold = 24;
  const isBgColor = (i) =>
    data[i] < bgThreshold && data[i + 1] < bgThreshold && data[i + 2] < bgThreshold;

  const visited = new Uint8Array(width * height);
  const queue = [];
  const seeds = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  for (const [sx, sy] of seeds) {
    const i = idx(sx, sy);
    if (isBgColor(i)) {
      const p = sy * width + sx;
      if (!visited[p]) { visited[p] = 1; queue.push(sx, sy); }
    }
  }

  let bgRemoved = 0;
  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    const i = idx(x, y);
    // make transparent
    if (data[i + 3] !== 0) { data[i + 3] = 0; bgRemoved++; }
    // 4-neighbors
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const np = ny * width + nx;
      if (visited[np]) continue;
      const ni = idx(nx, ny);
      if (isBgColor(ni)) { visited[np] = 1; queue.push(nx, ny); }
    }
  }
  console.log(`background pixels removed (flood-fill): ${bgRemoved}`);

  // Also soften the hard edge: for any pixel that is near-black AND currently
  // fully transparent-adjacent, fade alpha so we avoid a jaggy halo.
  // (Light pass: pixels with RGB<60 that neighbor a now-transparent pixel -> semi-transparent)
  // Skip for simplicity; flood fill already gives clean edges for solid black bg.

  // Re-encode as RGBA PNG (true alpha, not palette) so browsers render transparency reliably.
  let pipeline = sharp(data, {
    raw: { width, height, channels },
  }).png({ compressionLevel: 9, palette: false });

  // Trim transparent margins (sharp's trim works on alpha via threshold)
  // Use trim with a background tolerance that catches near-transparent edges.
  pipeline = pipeline.trim({ threshold: 10 });

  const trimmed = await pipeline.toBuffer({ resolveWithObject: false });
  // Read trimmed metadata
  const tMeta = await sharp(trimmed).metadata();
  console.log(`after trim: ${tMeta.width}x${tMeta.height}`);

  // Resize so the LONGEST side is at most 400px (keeps aspect ratio).
  const maxDim = 400;
  const longest = Math.max(tMeta.width, tMeta.height);
  const scale = longest > maxDim ? maxDim / longest : 1;
  const finalW = Math.round(tMeta.width * scale);
  const finalH = Math.round(tMeta.height * scale);

  const finalBuf = await sharp(trimmed)
    .resize(finalW, finalH, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  fs.writeFileSync(OUT, finalBuf);
  console.log(`saved ${OUT}: ${finalW}x${finalH}, ${finalBuf.length} bytes`);

  // Small variant for favicon: 96x96
  const smBuf = await sharp(trimmed)
    .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  fs.writeFileSync(OUT_SM, smBuf);
  console.log(`saved ${OUT_SM}: 96x96, ${smBuf.length} bytes`);

  // Verify
  const verify = await sharp(OUT).metadata();
  console.log(`verify: ${verify.width}x${verify.height} channels=${verify.channels} hasAlpha=${verify.hasAlpha} isPalette=${verify.isPalette}`);
  const v = await sharp(OUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphas = {};
  for (let i = 3; i < v.data.length; i += v.info.channels) {
    const a = v.data[i];
    alphas[a] = (alphas[a] || 0) + 1;
  }
  console.log('final alpha histogram (top 5):', Object.entries(alphas).sort((a, b) => b[1] - a[1]).slice(0, 5));
})();
