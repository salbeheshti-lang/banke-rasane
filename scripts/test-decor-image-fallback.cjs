#!/usr/bin/env node
/**
 * End-to-end smoke test for the decor IMDb -> Wikipedia/Wikimedia image fallback.
 *
 * Run with an authenticated local app:
 *   BANKRESANE_TEST_URL=http://localhost:3000
 *   BANKRESANE_TEST_TOKEN='your-bearer-token'
 *   node scripts/test-decor-image-fallback.cjs
 *
 * Optional:
 *   BANKRESANE_TEST_SHOW_NAME='known program title'
 */
const IMDbUrl = 'https://www.imdb.com/title/tt1121180/?ref_=ttep_ep_1';
const baseUrl = (process.env.BANKRESANE_TEST_URL || '').replace(/\/$/, '');
const token = process.env.BANKRESANE_TEST_TOKEN;
const showName = process.env.BANKRESANE_TEST_SHOW_NAME || '';

if (!baseUrl || !token) {
  console.error('Set BANKRESANE_TEST_URL and BANKRESANE_TEST_TOKEN to run this authenticated end-to-end test.');
  process.exit(2);
}

(async () => {
  const response = await fetch(`${baseUrl}/api/fetch-show-info`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      url: IMDbUrl,
      category: 'دکور',
      showName,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`API returned HTTP ${response.status}: ${payload.error || 'unknown error'}`);
  }

  const imageUrl = payload?.info?.image;
  if (typeof imageUrl !== 'string' || !imageUrl) {
    throw new Error('The decor IMDb import returned no image.');
  }

  const image = new URL(imageUrl);
  if (image.protocol !== 'https:' || !(image.hostname === 'upload.wikimedia.org' || image.hostname.endsWith('.wikimedia.org'))) {
    throw new Error(`Expected a Wikimedia image URL, received: ${imageUrl}`);
  }

  const imageResponse = await fetch(imageUrl, { method: 'GET' });
  if (!imageResponse.ok) {
    throw new Error(`Wikimedia image is not reachable: HTTP ${imageResponse.status}`);
  }
  const contentType = imageResponse.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Wikimedia URL did not return an image (content-type: ${contentType || 'missing'})`);
  }

  console.log('PASS: authenticated decor IMDb import returned a reachable Wikimedia image.');
  console.log(`Title: ${payload.info.title || '(title unavailable)'}`);
  console.log(`Image: ${imageUrl}`);
  console.log('NOTE: confirm visually that the image belongs to the intended program/set; HTTP checks cannot establish semantic relevance.');
  await imageResponse.body?.cancel();
})().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
