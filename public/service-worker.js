const CACHE_NAME = 'mahjong-ai-v11';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './js/tiles.js',
  './js/shanten.js',
  './js/score.js',
  './js/ocr.js',
  './js/sfx.js',
  './js/game.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // GET 以外はキャッシュ対象外 (そのままネットワークへ)
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // 同一オリジンの成功応答はランタイムキャッシュへ保存し、次回以降オフラインでも使えるようにする
        const isSameOrigin = new URL(request.url).origin === self.location.origin;
        if (response && response.status === 200 && isSameOrigin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
