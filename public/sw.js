/* Minimal service worker: caches shell and attempts background sync when available */
const CACHE_VERSION = '2025-12-12-v2'; // Update this on each deploy
const CACHE_NAME = `pinseekr-shell-${CACHE_VERSION}`;
const ASSETS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (e) => {
  // cache app shell
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Delete old caches to prevent stale HTML from referencing removed assets
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('pinseekr-shell-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});

self.addEventListener('sync', (e) => {
  if (e.tag === 'outbox-sync') {
    e.waitUntil(
      // post message to all clients to trigger publish
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_OUTBOX' });
        });
      })
    );
  }
});
