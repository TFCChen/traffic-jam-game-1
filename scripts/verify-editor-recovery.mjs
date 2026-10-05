// Disposable editor/storage fixture and simulated WebGL loss, never user data.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const ws=new WebSocket(process.argv[2]);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
let id=0,session;const pending=new Map();ws.onmessage=e=>{const r=JSON.parse(e.data),p=pending.get(r.id);if(p){pending.delete(r.id);r.error?p.reject(Error(r.error.message)):p.resolve(r.result);}};
const send=(method,params={},attached=true)=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params,...(attached?{sessionId:session}:{})}));});
const targets=await send('Target.getTargets',{},false),page=targets.targetInfos.find(t=>t.type==='page'&&t.url.startsWith('http://localhost:4173'));assert.ok(page);
session=(await send('Target.attachToTarget',{targetId:page.targetId,flatten:true},false)).sessionId;
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100);}throw Error(expression);}
async function click(text){await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)throw Error('Unavailable button');b.click();})()`);}
async function shot(name){await sleep(650);writeFileSync(new URL(`../docs/upgrade-2026-10-05/${name}.png`,import.meta.url),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
const keys=['traffic-jam-progress-v2','traffic-jam-scene','traffic-jam-custom-levels-v2','traffic-jam-draft-v1','traffic-jam-session-v1','traffic-jam-tutorial-v1'];
const saved=await evaluate(`Object.fromEntries(${JSON.stringify(keys)}.map(k=>[k,localStorage.getItem(k)]))`);
try{
  await evaluate("(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const k of await caches.keys())if(k.startsWith('traffic-jam-'))await caches.delete(k);localStorage.removeItem('traffic-jam-session-v1');localStorage.removeItem('traffic-jam-draft-v1');localStorage.setItem('traffic-jam-tutorial-v1','true');localStorage.setItem('traffic-jam-progress-v2','{}');})()");
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate("localStorage.setItem('traffic-jam-custom-levels-v2','[]');localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:60,yaw:-12,quality:'standard',theme:'day',motion:1.2}));location.reload()");
  await until("document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&!document.querySelector('.toolbar button:nth-child(3)').disabled");
  await click('編輯器');await until("document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready");await click('清空');
  await until("document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length===0");
  for(const x of [.5,1.5]){
    const p=await evaluate(`document.querySelector('.garage-canvas').garageInspection.project(${x},.055,2.5)`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await sleep(100);
  }
  assert.equal(await evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length"),1);
  await click('儲存');await until("JSON.parse(localStorage.getItem('traffic-jam-custom-levels-v2')).length===1");
  await until("[...document.querySelectorAll('.editor-actions button')].some(b=>b.textContent.trim()==='試玩'&&!b.disabled)");
  await shot('19-editor-saved');await click('試玩');
  await until("document.querySelector('.stage-heading h2')?.textContent==='自製關卡 1'&&!document.querySelector('.toolbar button:nth-child(3)').disabled");
  await shot('20-custom-play');
  await evaluate("document.querySelector('.garage-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()");
  await until("!!document.querySelector('.scene-fallback')&&document.querySelectorAll('.vehicle').length===1");
  await shot('21-fallback');
  const body=await evaluate("(()=>{const el=document.querySelector('.vehicle');el.focus();return true;})()");assert.ok(body);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await until("document.querySelector('.stats b')?.textContent==='1'");
  console.log('Isolated custom save, play, WebGL loss fallback and keyboard move passed.');
}finally{
  await send('Emulation.clearDeviceMetricsOverride');
  await evaluate(`(()=>{for(const [k,v]of Object.entries(${JSON.stringify(saved)}))v==null?localStorage.removeItem(k):localStorage.setItem(k,v);location.reload()})()`);ws.close();
}
