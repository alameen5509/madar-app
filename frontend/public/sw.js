const CACHE_NAME = 'madar-v1';
const OFFLINE_URL = '/tasks';

// الملفات الأساسية للعمل offline
const PRECACHE_URLS = [
  '/',
  '/tasks',
  '/habits',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // تجاهل أخطاء الكاش في التثبيت الأول
      });
    })
  );
  self.skipWaiting();
});

// تفعيل وحذف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// استراتيجية: Network First مع fallback للكاش
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // تجاهل non-GET requests
  if (request.method !== 'GET') return;

  // تجاهل API calls — دائماً من الشبكة
  if (request.url.includes('/api/')) return;

  // تجاهل chrome-extension و non-http
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // كاش النسخة الجديدة
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // offline — أرجع من الكاش
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // إذا صفحة HTML، أرجع صفحة المهام
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match(OFFLINE_URL);
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
