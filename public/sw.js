const CACHE_NAME = 'bankresaneh-shell-v2';
const OFFLINE_URL = '/offline.html';
const STATIC_PREFIXES = ['/fonts/', '/icons/', '/_next/static/'];
const STATIC_FILES = ['/favicon.ico', '/banke-rasane-logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Offline support is optional. A cache quota or edge response failure
    // must never prevent the new worker from installing.
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await fetch(OFFLINE_URL, { cache: 'reload' });
      if (response.ok && response.type === 'basic') {
        try {
          await cache.put(OFFLINE_URL, response);
        } catch {
          // Best-effort only; continue installing without an offline page.
        }
      }
    } catch {
      // Continue installation even when Cache Storage is unavailable.
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
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache API responses, login/session data, or private report content.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/login') || url.pathname.includes('/settings/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      try {
        return (await caches.match(OFFLINE_URL)) || Response.error();
      } catch {
        return Response.error();
      }
    }));
    return;
  }

  if (STATIC_FILES.includes(url.pathname) || STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    // Runtime asset caching is deliberately disabled on the preview. Some
    // edge/browser combinations reject Cache.put() for streamed responses.
    // Network delivery remains primary; a previously stored response is only
    // used as a fallback when the network request itself fails.
    event.respondWith(fetch(request).catch(async () => {
      try {
        return (await caches.match(request)) || Response.error();
      } catch {
        return Response.error();
      }
    }));
  }
});
