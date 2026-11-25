#!/usr/bin/env node
/**
 * End-to-end smoke test for the decor IMDb -> Wikipedia/Wikimedia image fallback.
 *
 * Run with an authenticated local app:
 *   BANKRESANE_TEST_URL=http://localhost:3002
 *   BANKRESANE_TEST_TOKEN='your-bearer-token'
 *   node scripts/test-decor-image-fallback.cjs
 *
 * Optional:
 *   BANKRESANE_TEST_SHOW_NAME='known program title'
 */
const IMDbUrl = 'https://www.imdb.com/title/tt1121180/?ref_=ttep_ep_1';
const legacyBase = (process.env.BANKRESANE_TEST_URL || '').replace(/\/$/, '');
const nextBase = (process.env.BANKRESANE_TEST_NEXT_URL || legacyBase).replace(/\/$/, '');
const apiBase = (process.env.BANKRESANE_TEST_API_URL || legacyBase).replace(/\/$/, '');
const token = process.env.BANKRESANE_TEST_TOKEN;
const showName = process.env.BANKRESANE_TEST_SHOW_NAME || '';

if (!nextBase || !apiBase || !token) {
  console.error('Set BANKRESANE_TEST_URL and BANKRESANE_TEST_TOKEN to run this authenticated end-to-end test.');
  process.exit(2);
}

(async () => {
  const response = await fetch(`${nextBase}/api/fetch-show-info`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-BankResaneh-Api-Base': apiBase,
    },
    body: JSON.stringify({
      url: IMDbUrl,
      category: 'تاک‌شوی مصاحبه‌محور',
      showName,
      isDecor: true,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  console.log(`[IMDb import] HTTP ${response.status}; title=${payload.info?.title || 'none'}; image=${payload.info?.image || 'none'}; error=${payload.error || payload.message || 'none'}`);
  const failures = [];
  if (!response.ok) failures.push(`IMDb metadata route returned HTTP ${response.status}: ${payload.error || 'unknown error'}`);

  const imageUrl = payload?.info?.image;
  console.log(`[IMDb import] showName=${showName || 'none'}; title=${payload.info?.title || 'none'}; image=${imageUrl || 'none'}`);
  let imageResponse = null;
  if (typeof imageUrl !== 'string' || !imageUrl) {
    failures.push('The decor IMDb import returned no image.');
  } else {
    try {
      const image = new URL(imageUrl);
      if (image.protocol !== 'https:' || !(image.hostname === 'upload.wikimedia.org' || image.hostname.endsWith('.wikimedia.org'))) {
        failures.push(`Expected a Wikimedia image URL, received: ${imageUrl}`);
      } else {
        imageResponse = await fetch(imageUrl, { method: 'GET' });
        if (!imageResponse.ok) {
          failures.push(`Wikimedia image is not reachable: HTTP ${imageResponse.status}`);
        } else {
          const contentType = imageResponse.headers.get('content-type') || '';
          if (!contentType.toLowerCase().startsWith('image/')) {
            failures.push(`Wikimedia URL did not return an image (content-type: ${contentType || 'missing'})`);
          } else {
            console.log('PASS: authenticated decor IMDb import returned a reachable Wikimedia image.');
          }
        }
      }
    } catch (error) {
      failures.push(`IMDb fallback image URL validation failed: ${error.message}`);
    }
  }

  const wikipediaPageUrl = process.env.BANKRESANE_TEST_WIKIPEDIA_URL || 'https://en.wikipedia.org/wiki/Top_Gear';
  const pageImportResponse = await fetch(`${apiBase}/api/import-image`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url: wikipediaPageUrl }),
  });
  const pageImport = await pageImportResponse.json().catch(() => ({}));
  if (!pageImportResponse.ok || typeof pageImport.dataUrl !== 'string' || !pageImport.dataUrl.startsWith('data:image/webp;base64,')) {
    failures.push(`Wikipedia page image import failed (HTTP ${pageImportResponse.status}): ${pageImport.error || 'no optimized image returned'}`);
  } else {
    console.log(`PASS: Wikipedia article page was resolved and its image optimized (${new URL(wikipediaPageUrl).hostname}).`);
  }

  if (failures.length) throw new Error(failures.join(' | '));
  console.log(`Title: ${payload.info?.title || '(title unavailable)'}`);
  console.log(`Image: ${imageUrl || '(no IMDb fallback image)'}`);
  console.log('NOTE: confirm visually that the image belongs to the intended program/set; HTTP checks cannot establish semantic relevance.');
  await imageResponse?.body?.cancel();
})().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
