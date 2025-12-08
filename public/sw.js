/* Minimal service worker: caches shell and attempts background sync when available */
const CACHE_NAME = 'pinseekr-shell-v1';
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
  e.waitUntil(self.clients.claim());
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
