// Capture the actual 3D scene at multiple angles. Use an isolated localhost:4173 browser.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
await mkdir(new URL('../.browser-checks/',import.meta.url),{recursive:true});
const ws=new WebSocket(process.argv[2]);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let sequence=0,session;const pending=new Map();
ws.onmessage=e=>{const r=JSON.parse(e.data),p=pending.get(r.id);if(p){pending.delete(r.id);r.error?p.reject(Error(r.error.message)):p.resolve(r.result);}};
const send=(method,params={},attached=true)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(attached?{sessionId:session}:{})}));});
const targets=await send('Target.getTargets',{},false),page=targets.targetInfos.find(t=>t.type==='page'&&t.url.startsWith('http://localhost:4173'));
assert.ok(page,'Open localhost:4173 first.');session=(await send('Target.attachToTarget',{targetId:page.targetId,flatten:true},false)).sessionId;
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const saved=await evaluate("Object.fromEntries(['traffic-jam-progress-v2','traffic-jam-scene','traffic-jam-session-v1','traffic-jam-tutorial-v1','traffic-jam-draft-v1'].map(k=>[k,localStorage.getItem(k)]))");
try{
  await evaluate("(async()=>{for(const reg of await navigator.serviceWorker.getRegistrations())await reg.unregister();for(const k of await caches.keys())if(k.startsWith('traffic-jam-'))await caches.delete(k);localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1','true');})()");
  for(const spec of [{name:'day-oblique',theme:'day',pitch:55,yaw:25,width:1280,height:900},
    {name:'sunset-oblique',theme:'sunset',pitch:55,yaw:-20,width:1280,height:900},
    {name:'neon-mobile',theme:'neon',pitch:60,yaw:15,width:375,height:800},
    {name:'day-mobile-default',theme:'day',pitch:60,yaw:-12,width:375,height:800},
    {name:'mobile-low-angle',theme:'day',pitch:45,yaw:35,width:320,height:700},
    {name:'mobile-high-angle',theme:'day',pitch:80,yaw:-35,width:320,height:700}]){
    await send('Emulation.setDeviceMetricsOverride',{width:spec.width,height:spec.height,deviceScaleFactor:1,mobile:spec.width<500});
    await evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1','true');localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,{completed:true,stars:1,bestMoves:99}]))));localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1','true');localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:${spec.pitch},yaw:${spec.yaw},light:-40,intensity:3,shadows:true,theme:'${spec.theme}',quality:'high',motion:1.2}));location.reload()`);
    await sleep(400);let ready=false;
    for(let i=0;i<120;i++){ready=await evaluate("!!document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready");if(ready)break;await sleep(100);}
    assert.ok(ready);await sleep(1500);
    const result=await evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection,failures=[];for(const car of a.snapshot().cars){const [x,,z]=car.position;for(const offset of [-.25,0,.25]){const p=a.project(x+(car.dir==='H'?offset:0),.55,z+(car.dir==='V'?offset:0));if(a.pick(p.x,p.y)!==car.id)failures.push(car.id);}}return {failures,overflow:document.documentElement.scrollWidth>innerWidth,settings:a.snapshot().settings};})()`);
    assert.deepEqual(result.failures,[],`${spec.name}: rendered car must remain selectable`);assert.equal(result.overflow,false);
    const fits=await evaluate("(()=>{const canvas=document.querySelector('.garage-canvas'),a=canvas.garageInspection,r=canvas.getBoundingClientRect();return [0,6].every(x=>[0,6].every(z=>{const p=a.project(x,.055,z);return p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom;}));})()");
    assert.equal(fits,true,`${spec.name}: all four puzzle corners remain in frame`);
    await writeFile(new URL(`../.browser-checks/art-${spec.name}.png`,import.meta.url),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    console.log(`${spec.name}: 24 car hit samples and no horizontal overflow passed; screenshot saved.`);
  }
}finally{
  await evaluate(`(()=>{for(const [k,v]of Object.entries(${JSON.stringify(saved)}))v==null?localStorage.removeItem(k):localStorage.setItem(k,v);location.reload()})()`);
  await send('Emulation.clearDeviceMetricsOverride');ws.close();
}
