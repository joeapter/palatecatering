// sw.js — Palate Catering offline caching
self.addEventListener('install', event => {
  self.skipWaiting();
  // Minimal cache: only static assets, no HTML so pages always load fresh.
  event.waitUntil(
    caches.open('palate-cache-v3-assets').then(cache => {
      return cache.addAll([
        '/assets/logo.png'
      ]);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('palate-cache-') && k !== 'palate-cache-v3-assets')
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // Bypass cache for HTML/navigation to avoid stale pages
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req).catch(() => new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } }))
    );
    return;
  }
  // Cache-first for cached assets, network fallback
  event.respondWith(
    caches.match(req).then(response => response || fetch(req))
  );
});
