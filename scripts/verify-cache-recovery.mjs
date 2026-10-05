import { connect } from './cdp-test.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
const c = await connect(process.argv[2]);
const dir = new URL('../docs/cache-recovery-2026-10-06/', import.meta.url);
mkdirSync(dir, {recursive: true});
const fixture = new URL('../public/cache-recovery-fixture.js', import.meta.url);
writeFileSync(fixture, readFileSync(new URL('./fixtures/cache-recovery-worker.js', import.meta.url)));
try {
  await c.evaluate(`(async()=>{
    localStorage.setItem('cache-regression-progress','level-17');
    const unrelated=await caches.open('unrelated-test');
    await unrelated.put('/sentinel',new Response('keep'));
    await navigator.serviceWorker.register('/cache-recovery-fixture.js');
  })()`);
  await c.until(`navigator.serviceWorker.controller?.scriptURL.endsWith('/cache-recovery-fixture.js')`);
  await c.send('Page.reload');
  await c.until(`document.title==='Legacy fixture'`);
  writeFileSync(new URL('before.png',dir), Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
  await c.evaluate(`sessionStorage.setItem('recover','1')`);
  await c.send('Page.reload');
  await c.until(`document.querySelector('script[src="/@vite/client"]')!==null`);
  await c.until(`document.querySelector('canvas')!==null`);
  await c.sleep(3000);
  const result = await c.evaluate(`(async()=>({
    title:document.title,
    text:document.body.innerText,
    registrations:(await navigator.serviceWorker.getRegistrations()).length,
    caches:await caches.keys(),
    progress:localStorage.getItem('cache-regression-progress'),
    modelRequests:performance.getEntriesByType('resource').filter(r=>r.name.includes('.glb')).map(r=>r.name)
  }))()`);
  assert.equal(result.progress,'level-17');
  assert.equal(result.registrations,0);
  assert(result.caches.includes('unrelated-test'));
  assert(!result.caches.some(k=>k.startsWith('traffic-jam-')));
  assert(!result.text.includes('OLD UI'));
  assert(!result.text.includes('車庫已可點擊遊玩'));
  assert(result.modelRequests.length>0);
  assert(result.modelRequests.every(u=>new URL(u).searchParams.get('v')?.length===16));
  writeFileSync(new URL('after.png',dir), Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
  writeFileSync(new URL('verification.json',dir), JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally { unlinkSync(fixture); c.close(); }
