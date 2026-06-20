/* sw.js — offline cache for the static shell + assets */
const CACHE = 'northstar-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/storage.js',
  './js/nudges.js',
  './js/gamification.js',
  './js/quiz.js',
  './js/api.js',
  './js/timer.js',
  './js/views.js',
  './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // never cache Anthropic API or Google Fonts CSS (they need fresh)
  if (url.host === 'api.anthropic.com') return;
  if (e.request.method !== 'GET') return;

  // network-first for Google Fonts (woff2 — they cache well anyway)
  if (url.host.includes('gstatic.com') || url.host.includes('googleapis.com')) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return res;
        }).catch(() => cached)
      )
    );
    return;
  }

  // cache-first for own assets
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res && res.status === 200 && (url.origin === location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
