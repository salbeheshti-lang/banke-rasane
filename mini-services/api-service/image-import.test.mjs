import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { importImageFromUrl, optimizeImageBuffer } from './image-import.mjs';

const png = await sharp({
  create: { width: 64, height: 48, channels: 3, background: { r: 24, g: 112, b: 168 } },
}).png().toBuffer();

function imageResponse() {
  return new Response(png, {
    status: 200,
    headers: { 'content-type': 'image/png', 'content-length': String(png.length) },
  });
}

test('optimizes an uploaded SVG logo into WebP without browser decoding', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#167a50"/></svg>');
  const output = await optimizeImageBuffer(svg);
  assert.equal(output.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(output.subarray(8, 12).toString('ascii'), 'WEBP');
});

test('rejects unsupported uploaded file bytes', async () => {
  await assert.rejects(() => optimizeImageBuffer(Buffer.from('not an image')));
});

test('imports a direct Wikimedia image and optimizes it to WebP', async () => {
  const result = await importImageFromUrl(
    'https://upload.wikimedia.org/wikipedia/commons/test-image.png',
    async () => imageResponse(),
  );
  assert.equal(result.status, 200);
  assert.match(result.body.dataUrl, /^data:image\/webp;base64,/);
  assert.ok(result.body.size > 0 && result.body.size <= 2 * 1024 * 1024);
});

test('resolves a Wikipedia article through its fixed summary API', async () => {
  const calls = [];
  const result = await importImageFromUrl('https://en.wikipedia.org/wiki/Top_Gear', async (url) => {
    calls.push(String(url));
    if (String(url).includes('/api/rest_v1/page/summary/')) {
      return new Response(JSON.stringify({
        originalimage: { source: 'https://upload.wikimedia.org/wikipedia/commons/test-image.png' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return imageResponse();
  });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('en.wikipedia.org/api/rest_v1/'));
});

test('resolves an IMDb title page through its Open Graph image', async () => {
  const calls = [];
  const result = await importImageFromUrl('https://www.imdb.com/title/tt1234567/', async (url) => {
    calls.push(String(url));
    if (String(url).includes('imdb.com/title/tt1234567/')) {
      return new Response('<html><meta property="og:image" content="https://m.media-amazon.com/images/test-poster.jpg"></html>', {
        status: 200, headers: { 'content-type': 'text/html' },
      });
    }
    return imageResponse();
  });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 2);
  assert.match(result.body.dataUrl, /^data:image\/webp;base64,/);
});

test('rejects redirect to an unapproved image host', async () => {
  const result = await importImageFromUrl(
    'https://upload.wikimedia.org/wikipedia/commons/test-image.png',
    async () => new Response(null, {
      status: 302,
      headers: { location: 'https://evil.example/private.png' },
    }),
  );
  assert.equal(result.status, 400);
});

test('rejects arbitrary source hosts before making a network request', async () => {
  let called = false;
  const result = await importImageFromUrl('https://evil.example/image.png', async () => {
    called = true;
    return imageResponse();
  });
  assert.equal(result.status, 400);
  assert.equal(called, false);
});

test('rejects oversized streamed images even when Content-Length is absent', async () => {
  const body = new ReadableStream({
    start(controller) {
      const chunk = new Uint8Array(5 * 1024 * 1024);
      for (let index = 0; index < 6; index++) controller.enqueue(chunk);
      controller.close();
    },
  });
  const result = await importImageFromUrl(
    'https://upload.wikimedia.org/wikipedia/commons/oversized.png',
    async () => new Response(body, { status: 200, headers: { 'content-type': 'image/png' } }),
  );
  assert.equal(result.status, 413);
});

test('resolves a Wikimedia Commons file page through the Commons imageinfo API', async () => {
  const calls = [];
  const result = await importImageFromUrl('https://commons.wikimedia.org/wiki/File:Example_studio.jpg', async (url) => {
    calls.push(String(url));
    if (String(url).includes('/w/api.php')) {
      return new Response(JSON.stringify({
        query: { pages: { 123: { imageinfo: [{ thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example_studio.jpg/1600px-Example_studio.jpg' }] } } },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return imageResponse();
  });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('commons.wikimedia.org/w/api.php'));
  assert.match(result.body.dataUrl, /^data:image\/webp;base64,/);
});

test('sniffs valid image bytes when the source server sends application/octet-stream', async () => {
  const result = await importImageFromUrl(
    'https://upload.wikimedia.org/wikipedia/commons/octet-stream.png',
    async () => new Response(png, { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
  );
  assert.equal(result.status, 200);
  assert.match(result.body.dataUrl, /^data:image\/webp;base64,/);
});
