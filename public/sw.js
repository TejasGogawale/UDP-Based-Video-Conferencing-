// Service Worker for VIT Connect PWA (enables Android 'Install App' / WebAPK)
const CACHE_NAME = 'vit-connect-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first strategy so live API calls, WebSockets, and latest deployments are always fresh
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
