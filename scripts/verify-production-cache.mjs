import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { connect } from './cdp-test.mjs';
import { modelRevision } from '../vite.config.js';
const root = resolve('dist');
const fixture = readFileSync(new URL('./fixtures/cache-recovery-worker.js',import.meta.url),'utf8').replace('if(sessionStorage.recover)', 'navigator.serviceWorker.addEventListener("controllerchange",()=>location.reload());if(sessionStorage.recover)');
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
let offline = false;
const server = createServer((req,res)=>{
  if (offline) { req.socket.destroy(); return; }
  const pathname = new URL(req.url,'http://localhost').pathname;
  if(pathname==='/cache-recovery-fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(fixture);return;}
  const path = resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(root)||!existsSync(path)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');res.end(readFileSync(path));
});
await new Promise(r=>server.listen(4174,'127.0.0.1',r));
const env={...process.env,AGENT_BROWSER_SOCKET_DIR:resolve('.browser-checks')};
const browser=async(args)=>(await promisify(execFile)('agent-browser.cmd',['--session','production-cache',...args],{env,encoding:'utf8',shell:true})).stdout;
let c;
try {
  await browser(['open','http://localhost:4174/']);
  c=await connect((await browser(['get','cdp-url'])).trim(),'http://localhost:4174');
  await c.until(`navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js')`);
  await c.evaluate(`(async()=>{localStorage.setItem('cache-regression-progress','level-17');await navigator.serviceWorker.register('/cache-recovery-fixture.js')})()`);
  await c.until(`document.title==='Legacy fixture'`);
  await c.evaluate(`sessionStorage.setItem('recover','1')`);
  await c.send('Page.reload');
  await c.until(`document.title==='玩具車庫・交通解謎' && !!document.querySelector('canvas')`);
  await c.until(`navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js')`);
  await c.sleep(2000);
  offline = true;
  await c.send('Network.enable');
  await c.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await c.send('Page.reload');
  await c.until(`document.title==='玩具車庫・交通解謎' && !!document.querySelector('canvas')`);
  const result=await c.evaluate(`(async()=>{
    const r=await fetch('/models/racer.glb?v=${modelRevision}');
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
    let rejectsWrongVersion=false;try{await fetch('/models/racer.glb?v=old-version')}catch{rejectsWrongVersion=true}
    return {title:document.title,offlineModelStatus:r.status,hash,rejectsWrongVersion,progress:localStorage.getItem('cache-regression-progress'),caches:await caches.keys()};
  })()`);
  assert.equal(result.offlineModelStatus,200);
  assert.equal(result.hash,createHash('sha256').update(readFileSync('public/models/racer.glb')).digest('hex'));
  assert.equal(result.progress,'level-17');
  assert(result.rejectsWrongVersion);
  assert(!result.caches.includes('traffic-jam-legacy-test'));
  writeFileSync('docs/cache-recovery-2026-10-06/production-verification.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally {
  if(c){await c.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});c.close();}
  await browser(['close']);server.close();
}
