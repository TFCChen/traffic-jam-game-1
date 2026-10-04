// Opt-in CPU/GPU benchmark using real browser input. Restores test fixtures afterward.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const ws=new WebSocket(process.argv[2]);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
let id=0,session;const pending=new Map();ws.onmessage=e=>{const r=JSON.parse(e.data),p=pending.get(r.id);if(p){pending.delete(r.id);r.error?p.reject(Error(r.error.message)):p.resolve(r.result);}};
const send=(method,params={},attached=true)=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params,...(attached?{sessionId:session}:{})}));});
const baseUrl=process.argv[4]??'http://localhost:4173';
const targets=await send('Target.getTargets',{},false),page=targets.targetInfos.find(t=>t.type==='page'&&t.url.startsWith(baseUrl));
assert.ok(page);session=(await send('Target.attachToTarget',{targetId:page.targetId,flatten:true},false)).sessionId;
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<150;i++){if(await evaluate("!!document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready")){await sleep(800);return;}await sleep(100);}throw Error('Load timed out.');}
const saved=await evaluate("Object.fromEntries(['traffic-jam-progress-v2','traffic-jam-scene'].map(k=>[k,localStorage.getItem(k)]))");
const results=[];
try{
  for(const spec of [{name:'desktop-day',theme:'day',width:1280,height:900,dpr:1},{name:'desktop-night',theme:'neon',width:1280,height:900,dpr:1},{name:'mobile-night',theme:'neon',width:375,height:800,dpr:2}]){
    await send('Emulation.setDeviceMetricsOverride',{width:spec.width,height:spec.height,deviceScaleFactor:spec.dpr,mobile:spec.width<500});
    await evaluate(`localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,{completed:true}]))));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:65,yaw:0,light:-40,intensity:3,shadows:true,theme:'${spec.theme}',quality:'standard',motion:1.2}));location.reload()`);
    await sleep(400);await ready();
    await evaluate("document.querySelector('.garage-canvas').garageInspection.measure(true)");await sleep(2200);
    const idle=await evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot().performance.profile");
    const points=await evaluate("(()=>{const a=document.querySelector('.garage-canvas').garageInspection,c=a.snapshot().cars.find(c=>c.id==='green'),[x,,z]=c.position;return {from:a.project(x,.55,z),unit:a.project(x+1,.55,z)}})()");
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...points.from});await send('Input.dispatchMouseEvent',{type:'mousePressed',...points.from,button:'left',clickCount:1});
    assert.equal(await evaluate("document.querySelector('.garage-canvas').dataset.dragging"),'green');
    await evaluate("document.querySelector('.garage-canvas').garageInspection.measure(true)");
    for(let step=0;step<90;step++){
      const t=.5+.4*Math.sin(step*.23);
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:points.from.x+(points.unit.x-points.from.x)*t,y:points.from.y+(points.unit.y-points.from.y)*t,button:'left',buttons:1});await sleep(28);
    }
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...points.from,button:'left',clickCount:1});
    const active=await evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot().performance.profile");
    await evaluate("document.querySelector('.garage-canvas').garageInspection.measure(false)");
    const result={name:spec.name,idle,active};results.push(result);console.log(JSON.stringify(result));
  }
  if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(results,null,2));
}finally{
  await evaluate(`(()=>{for(const [k,v]of Object.entries(${JSON.stringify(saved)}))v==null?localStorage.removeItem(k):localStorage.setItem(k,v);location.reload()})()`);
  await send('Emulation.clearDeviceMetricsOverride');ws.close();
}
