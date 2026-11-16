/* Offline support: network first (so updates show up as soon as you're online), cache as the fallback.
   Requests to your sync worker are cross-origin and never touched here. */
const CACHE = 'signal-v5';
const SHELL = ['./', 'index.html', 'styles.css', 'core.js', 'app.js', 'fonts.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'fonts/Geist-normal-400-latin.woff2', 'fonts/Geist-normal-500-latin.woff2', 'fonts/Geist-normal-600-latin.woff2',
  'fonts/GeistMono-normal-400-latin.woff2', 'fonts/GeistMono-normal-500-latin.woff2',
  'fonts/Newsreader-normal-400-latin.woff2', 'fonts/Newsreader-normal-500-latin.woff2', 'fonts/Newsreader-italic-400-latin.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
