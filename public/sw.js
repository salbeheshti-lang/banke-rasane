const CACHE_NAME = 'bankresaneh-shell-v3';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Offline support is optional. Cache failures must never block installation.
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await fetch(OFFLINE_URL, { cache: 'reload' });
      if (response.ok && response.type === 'basic') {
        try {
          await cache.put(OFFLINE_URL, response);
        } catch {
          // Best-effort only.
        }
      }
    } catch {
      // Continue installation when Cache Storage or the edge is unavailable.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter((key) => key.startsWith('bankresaneh-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key).catch(() => false)));
    } catch {
      // Cache cleanup must not block activation.
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only provide an offline fallback for top-level navigation. In particular,
  // never intercept JS, CSS, fonts, images, API calls, or application data.
  // Those requests must go directly through the browser's normal network stack
  // so a failed edge transfer is not converted into an opaque Response.error().
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    request.mode !== 'navigate'
  ) return;

  event.respondWith(fetch(request).catch(async () => {
    try {
      return (await caches.match(OFFLINE_URL)) || Response.error();
    } catch {
      return Response.error();
    }
  }));
});
