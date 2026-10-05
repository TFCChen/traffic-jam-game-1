const CACHE = 'traffic-jam-legacy-test';
self.addEventListener('install', e => e.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.put('/index.html', new Response('<!doctype html><title>Legacy fixture</title><body>OLD UI 選車<script>if(sessionStorage.recover)navigator.serviceWorker.register("/sw.js")</script></body>', {headers: {'Content-Type': 'text/html'}}));
  await self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') e.respondWith(caches.open(CACHE).then(c => c.match('/index.html')));
});
