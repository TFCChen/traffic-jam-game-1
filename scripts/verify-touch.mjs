// Browser integration test. Pass the test browser's CDP WebSocket URL as argument.
// Uses real Chrome touch input; fixtures and preferences are restored on completion.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
await mkdir(new URL('../.browser-checks/',import.meta.url),{recursive:true});
const ws=new WebSocket(process.argv[2]);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let sequence=0,session;const pending=new Map();
ws.onmessage=event=>{const r=JSON.parse(event.data);if(pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(r.error.message)):p.resolve(r.result);}};
function send(method,params={},attached=true){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(attached?{sessionId:session}:{})}));});}
const targets=await send('Target.getTargets',{},false);
const page=targets.targetInfos.find(t=>t.type==='page'&&t.url.startsWith('http://localhost:4173'));
assert.ok(page,'Open localhost:4173 in the test browser first.');
session=(await send('Target.attachToTarget',{targetId:page.targetId,flatten:true},false)).sessionId;
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+JSON.stringify(r.exceptionDetails));return r.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<100;i++){if(await evaluate("!!document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready")){await sleep(400);return;}await sleep(100);}throw Error('Models not ready');}
async function click(text){await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)}||b.textContent.trim().startsWith(${JSON.stringify(text)})&&b.closest('.quality-options'));if(!b)throw Error('Missing button '+${JSON.stringify(text)});b.click();})()`);await sleep(150);}
const saved=await evaluate("Object.fromEntries(['traffic-jam-progress-v2','traffic-jam-scene','traffic-jam-session-v1','traffic-jam-tutorial-v1','traffic-jam-draft-v1'].map(k=>[k,localStorage.getItem(k)]))");
async function touch(type,p){await send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1,radiusX:4,radiusY:4,force:1}]:[]});await sleep(80);}
try{
  await evaluate("(async()=>{for(const reg of await navigator.serviceWorker.getRegistrations())await reg.unregister();for(const k of await caches.keys())if(k.startsWith('traffic-jam-'))await caches.delete(k);localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1','true');})()");
  await evaluate("document.querySelector('dialog')?.dispatchEvent(new Event('cancel',{cancelable:true}))");
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:2,mobile:true});
  await evaluate("localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1','true');localStorage.setItem('traffic-jam-scene',JSON.stringify({...JSON.parse(localStorage.getItem('traffic-jam-scene')||'{}'),motion:1}));location.reload()");await sleep(500);
  await ready();
  const blocked=await evaluate("(()=>{const a=document.querySelector('.garage-canvas').garageInspection,c=a.snapshot().cars.find(c=>c.id==='target'),[x,,z]=c.position;return {point:a.project(x,.55,z),position:c.position}})()");
  const contactSamples=evaluate("(async()=>{const samples=[];for(let i=0;i<20;i++){samples.push(document.querySelector('.garage-canvas').garageInspection.snapshot().cars.find(c=>c.id==='target'));await new Promise(r=>setTimeout(r,25));}return samples;})()");
  await touch('touchStart',blocked.point);
  let contactPeak=0,compressionPeak=0;
  for(const car of await contactSamples){
    assert.deepEqual(car.position,blocked.position);assert.equal(car.wheelTilt,0);assert.ok(Math.abs(car.tilt)<=.02);contactPeak=Math.max(contactPeak,Math.abs(car.tilt));
    assert.ok(car.compression<=0&&car.compression>=-.006);compressionPeak=Math.min(compressionPeak,car.compression);
  }
  await touch('touchEnd');
  assert.ok(contactPeak>.001,'Blocked car should visibly compress once.');
  assert.ok(compressionPeak<-.0005,'Contact must compress suspension while wheels stay grounded.');
  await sleep(500);
  const settled=await evaluate("({car:document.querySelector('.garage-canvas').garageInspection.snapshot().cars.find(c=>c.id==='target'),performance:document.querySelector('.garage-canvas').garageInspection.snapshot().performance,settings:document.querySelector('.garage-canvas').garageInspection.snapshot().settings})");
  assert.ok(Math.abs(settled.car.tilt)<.0001,`Contact must settle quickly: ${JSON.stringify(settled)}`);
  console.log(`Contact peak ${(contactPeak*180/Math.PI).toFixed(2)} degrees; stationary wheels and return to rest passed.`);
  const point=await evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection,c=a.snapshot().cars.find(c=>c.id==='green'),[x,,z]=c.position,p=a.project(x,.4,z);for(let dy=-35;dy<=35;dy+=2)for(let dx=-65;dx<=65;dx+=2){const q={x:p.x+dx,y:p.y+dy};if(!a.pick(q.x,q.y)&&a.pick(q.x,q.y,'touch')==='green')return q;}throw Error('No tolerance sample');})()`);
  const delta=await evaluate("(()=>{const a=document.querySelector('.garage-canvas').garageInspection,p=a.project(1,.4,1),q=a.project(1.45,.4,1);return {x:q.x-p.x,y:q.y-p.y}})()");
  await touch('touchStart',point);
  assert.equal(await evaluate("document.querySelector('.garage-canvas').dataset.dragging"),'green');
  await touch('touchMove',{x:point.x+delta.x,y:point.y+delta.y});
  const chassis=await evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot().cars.find(c=>c.id==='green')");
  assert.ok(Math.abs(chassis.tilt)<=.02);assert.equal(chassis.wheelTilt,0);
  await touch('touchEnd');
  assert.equal(await evaluate("document.querySelector('.stats b').textContent"),'1');
  for(let n=0;n<10&&await evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot().guide.visible");n++)await sleep(50);
  assert.equal(await evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot().guide.visible"),false);
  await click('重來');await sleep(500);
  await touch('touchStart',point);await touch('touchMove',{x:point.x+delta.x,y:point.y+delta.y});await touch('touchCancel');
  assert.equal(await evaluate("document.querySelector('.stats b').textContent"),'0');
  await touch('touchStart',point);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1},{x:point.x+15,y:point.y+15,id:2}]});
  await touch('touchEnd');
  assert.equal(await evaluate("document.querySelector('.garage-canvas').dataset.dragging"),undefined);
  assert.equal(await evaluate("document.querySelector('.stats b').textContent"),'0');
  console.log('Touch near-body grab, 0.45-cell snapping, cancellation and guide release passed.');
  await click('車庫設定');await click('精緻');
  await evaluate('location.reload()');await sleep(500);await ready();
  assert.equal(await evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot().settings.quality"),'high');
  await click('車庫設定');
  let perf=await evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot().performance");
  assert.equal(perf.pixelRatio,2);assert.equal(perf.shadowSize,2048);assert.equal(perf.shadows,true);
  await click('省電');perf=await evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot().performance");
  assert.equal(perf.pixelRatio,1);assert.equal(perf.shadows,false);
  await click('標準');await click('關閉車庫設定');
  // Nine prior completions excluding level 1 make the next real win unlock sunset.
  await evaluate("localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1','true');localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(Object.fromEntries(Array.from({length:9},(_,i)=>[i+2,{completed:true,stars:1,bestMoves:99}]))));location.reload()");
  await sleep(500);await ready();
  const route=[['green',1,0],['purpleBus',0,-1],['blueBus',0,-1],['sky',-3,0],['yellowBus',0,3],['orange',0,-1],['tealBus',-1,0],['blueBus',0,3],['target',3,0]];
  for(const [id,dx,dz] of route){
    const points=await evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection,c=a.snapshot().cars.find(c=>c.id==='${id}'),[x,,z]=c.position;return {from:a.project(x,.55,z),to:a.project(x+(${dx}),.55,z+(${dz}))}})()`);
    await touch('touchStart',points.from);assert.equal(await evaluate("document.querySelector('.garage-canvas').dataset.dragging"),id);
    await touch('touchMove',points.to);await touch('touchEnd');await sleep(180);
    const car=await evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot().cars.find(c=>c.id==='${id}')`);
    assert.ok(Math.abs(car.tilt)<=.02);assert.equal(car.wheelTilt,0);
  }
  await sleep(1700);
  const result=await evaluate("({win:!!document.querySelector('.win-card'),moves:document.querySelector('.stats b').textContent,rewards:[...document.querySelectorAll('.win-rewards span')].map(x=>x.textContent),progress:JSON.parse(localStorage.getItem('traffic-jam-progress-v2'))})");
  assert.equal(result.win,true);assert.equal(result.moves,'9');assert.equal(result.progress[1].perfect,true);
  assert.ok(result.rewards.some(r=>r.includes('黃昏車庫')));assert.ok(result.rewards.some(r=>r.includes('完美停車')));
  await writeFile(new URL('../.browser-checks/touch-win.png',import.meta.url),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await click('關閉通關結果');await click('關卡');await click('收藏');
  assert.equal(await evaluate("document.querySelectorAll('.badge.earned').length"),4);
  await writeFile(new URL('../.browser-checks/touch-collection.png',import.meta.url),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await click('收起面板');await sleep(1700);
  assert.equal(await evaluate("!!document.querySelector('.win-card')"),false,'Closing collection must not reopen dismissed results.');
  console.log('All quality profiles and real nine-step touch win with sunset/perfect rewards passed.');
}finally{
  await evaluate(`(()=>{for(const [k,v]of Object.entries(${JSON.stringify(saved)})){v==null?localStorage.removeItem(k):localStorage.setItem(k,v);}location.reload();})()`);
  await send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await send('Emulation.clearDeviceMetricsOverride');ws.close();
}
