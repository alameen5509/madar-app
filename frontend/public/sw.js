const CACHE_NAME = 'madar-v3';
const STATIC_CACHE = 'madar-static-v3';
const OFFLINE_URL = '/tasks';

const PRECACHE_URLS = [
  '/',
  '/tasks',
  '/manifest.json',
  '/favicon.svg',
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {})
    )
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Cache-First for static, Network-First for pages
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/')) return;
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // Static assets (fonts, images, JS/CSS with hashes) — Cache First
  if (url.pathname.startsWith('/_next/static/') ||
      url.pathname.endsWith('.woff2') ||
      url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      ).catch(() => caches.match(request))
    );
    return;
  }

  // Pages — Stale While Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => {
          if (cached) return cached;
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match(OFFLINE_URL);
          }
          return new Response('Offline', { status: 503 });
        });
        return cached || networkFetch;
      })
    )
  );
});
