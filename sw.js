// Bump VERSION when shipping changes so old caches are dropped.
const VERSION = 'steady-v1';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: answer from cache instantly (works offline),
// refresh the cache in the background so updates show on the next open.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const key = req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const network = fetch(req)
      .then((res) => { if (res.ok) cache.put(key, res.clone()); return res; })
      .catch(() => cached);
    if (cached) { e.waitUntil(network); return cached; }
    return network;
  }));
});
