// Development recovery worker. The production build replaces this file.
// A legacy cached production page still registers /sw.js on every visit:
// use that path to release localhost from its old offline snapshot.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  for (const key of await caches.keys()) {
    if (key.startsWith('traffic-jam-')) await caches.delete(key);
  }
  await self.registration.unregister();
  for (const client of await self.clients.matchAll({ type: 'window' })) {
    await client.navigate(client.url);
  }
})()));
