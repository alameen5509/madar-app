// Service Worker v7 — no page caching, clears all old caches

// Install — clear ALL old caches
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.skipWaiting();
});

// Activate — clear caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — always network, no caching
self.addEventListener('fetch', () => {
  // Do nothing — let browser handle all requests normally
});
