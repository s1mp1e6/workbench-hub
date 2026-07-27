const CACHE = 'personal-hub-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './apple-touch-icon.svg'
];

// Install: cache all key assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});

// Fetch: Cache-First for assets, Network-First for API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls to github.com → network-only
  if (url.hostname === 'api.github.com') {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({error:'offline'}), {status:503, headers:{'Content-Type':'application/json'}})));
    return;
  }

  // CDN scripts → cache with network update (stale-while-revalidate)
  if (url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('unpkg.com')) {
    e.respondWith(
      caches.open(CACHE + '-cdn').then(cache => {
        return cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(response => {
            cache.put(e.request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Everything else: Cache-First
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => {
      // Offline fallback: return the HTML for navigation requests
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      return new Response('Offline', {status: 503});
    }))
  );
});
