/* Minimal service worker for Tricycle PWA */
const CACHE_NAME = 'tricycle-cache-v1';
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/next.svg',
  '/vercel.svg',
  '/globe.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))).then(
      () => self.clients.claim()
    )
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Prefer network, fall back to cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
