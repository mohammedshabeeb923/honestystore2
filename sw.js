const CACHE_NAME = 'honesty-store-v14';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests (do NOT intercept Cashfree, APIs, or CDNs)
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  if (event.request.url.includes('/api/')) return;

  // Always fetch fresh from network, with offline cache fallback
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      return networkResponse;
    }).catch(() => {
      return caches.match(event.request, { ignoreSearch: true });
    })
  );
});
