import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { modelRevision } from '../vite.config.js';
const root = new URL("../dist/", import.meta.url);
const walk = (dir = "") =>
  readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((f) =>
    f.isDirectory()
      ? walk(`${dir}${f.name}/`)
      : f.name === "sw.js"
        ? []
        : [`${dir}${f.name}`],
  );
const files = walk(),
  hash = createHash("sha256");
for (const file of files) hash.update(readFileSync(new URL(file, root)));
const cache = `traffic-jam-${hash.digest("hex").slice(0, 16)}`,
  urls = files.map((f) => `/${f}`);
writeFileSync(
  new URL("sw.js", root),
  `const CACHE=${JSON.stringify(cache)},URLS=${JSON.stringify(urls)};
self.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open(CACHE);try{await cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})));await self.skipWaiting();}catch(error){await caches.delete(CACHE);throw error;}})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{await self.clients.claim();for(const key of await caches.keys())if(key.startsWith('traffic-jam-')&&key!==CACHE)await caches.delete(key);})()));
self.addEventListener('message',e=>{if(e.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin)return;e.respondWith((async()=>{const cache=await caches.open(CACHE);if(e.request.mode==='navigate'){try{const response=await fetch(new Request(e.request,{cache:'no-store'}));if(response.ok)return response;}catch{}return await cache.match('/index.html')||Response.error();}const cached=await cache.match(e.request);if(cached)return cached;try{return await fetch(e.request);}catch{if(url.pathname.startsWith('/models/')&&url.searchParams.get('v')===MODEL_REVISION)return await cache.match(url.pathname)||Response.error();return Response.error();}})());});
const MODEL_REVISION=${JSON.stringify(modelRevision)};`,
);
console.log(`Offline snapshot ${cache}: ${files.length} versioned files.`);
