import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { connect } from './cdp-test.mjs';
import { modelRevision } from '../vite.config.js';
const c=await connect(process.argv[2]);
const dir=new URL('../docs/glazing-structure-2026-10-06/',import.meta.url);mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const colors={racer:'#e54848',jeep:'#62b447',compact:'#52a6da',taxi:'#965ad0',pickup:'#e9a83f',delivery:'#bc54d5',schoolbus:'#f2d451',coach:'#4875dc',camper:'#60b49a'};
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const results=[];
const performanceResults=[];
async function load(kind,quality='high',pitch=32,yaw=180){
 const len=['coach','schoolbus','camper','delivery'].includes(kind)?3:2;
 const row=kind==='racer'?2:4;
 let cars=[{id:kind==='racer'?'target':kind,color:colors[kind],row,col:1,len,dir:'H'}];
 if(kind!=='racer')cars.push({id:'target',color:colors.racer,row:2,col:3,len:2,dir:'H'});
 if(kind==='fleet')cars=[['jeep',0,0,2],['compact',0,2,2],['taxi',0,4,2],['pickup',1,0,2],['delivery',1,2,3],['racer',2,0,2],['schoolbus',3,0,3],['coach',4,0,3],['camper',5,0,3]].map(([k,row,col,len])=>({id:k==='racer'?'target':k,color:colors[k],row,col,len,dir:'H'}));
 const level={id:'custom-structure-review',title:'車窗結構檢查',cars};
 const origin=await c.evaluate('performance.timeOrigin');
 await c.evaluate(`localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([${JSON.stringify(level)}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-structure-review',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:${pitch},yaw:${yaw},zoom:${kind==='fleet'?1:3},focusX:${kind==='fleet'?0:1+len/2-3},focusZ:${kind==='fleet'?0:row+.5-3},panX:0,panY:0,light:-40,intensity:3,shadows:true,theme:'day',quality:'${quality}',motion:1.2}));location.reload()`);
 await c.until(`performance.timeOrigin!==${origin}`);
 await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready===true`);
 await c.sleep(500);
 const s=await snap();
 assert.equal(s.sceneKey,'custom-structure-review-play');
 const revisions=await c.evaluate(`performance.getEntriesByType('resource').filter(r=>r.name.includes('.glb')).map(r=>new URL(r.name).searchParams.get('v'))`);
 assert(revisions.length&&revisions.every(v=>v===modelRevision),'Browser must render this exact model release');
 for(const car of s.cars)for(const g of car.glazing){assert.equal(g.roughness,.003);assert.equal(g.transmission,0);assert.equal(g.optics,'thin-sheet');}
 return s;
}
async function shot(name){writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));}
try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 for(const kind of Object.keys(colors)){
   await load(kind);await shot(kind+'-side');
   await load(kind,'high',40,135);await shot(kind+'-front');
   if(['coach','schoolbus','camper'].includes(kind)){await load(kind,'high',32,0);await shot(kind+'-entry');}
   results.push(kind+': side and front screenshots captured; clear thin-sheet optics confirmed.');
 }
 for(const quality of ['high','standard']){
   const before=await load('racer',quality,38,180);assert.equal(before.transmissionResolutionScale,1);
   await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:700,y:440,button:'right',buttons:2,clickCount:1});
   for(let i=1;i<=25;i++){
     await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:700+i*4,y:440+i,button:'right',buttons:2});await c.sleep(16);
     const s=await snap();assert.equal(s.transmissionResolutionScale,1);assert(s.cars.every(car=>car.glazing.every(g=>g.optics==='thin-sheet'&&g.transmission===0&&g.roughness===.003)));
     if(i===15)await shot(quality+'-during-orbit');
   }
   await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:800,y:465,button:'right',clickCount:1});
   await c.sleep(300);await shot(quality+'-after-orbit');
   results.push(quality+': actual right-button orbit preserves full glass resolution and material clarity.');
 }
 await load('racer','high',50,0);
 const p=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection,s=a.snapshot().cars[0],[x,,z]=s.position;for(const h of [.4,.5,.6]){const p=a.project(x,h,z);if(a.pick(p.x,p.y)==='target')return {from:p,to:a.project(x+1,h,z)};}return null})()`);
 assert(p,'The rebuilt racer must be selectable.');
 await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.from.x,y:p.from.y,button:'left',buttons:1,clickCount:1});
 for(let i=1;i<=20;i++){
   await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.from.x+(p.to.x-p.from.x)*i/20,y:p.from.y+(p.to.y-p.from.y)*i/20,button:'left',buttons:1});await c.sleep(16);
   assert.equal((await snap()).transmissionResolutionScale,1);
 }
 await shot('during-car-drag');
 await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.to.x,y:p.to.y,button:'left',clickCount:1});await c.sleep(300);
 assert.equal(await c.evaluate(`document.querySelector('.stats b').textContent`),'1');await c.click('復原');
 assert.equal(await c.evaluate(`document.querySelector('.stats b').textContent`),'0');
 results.push('Real car drag keeps clear glazing, records one move and can be undone.');
 for(const quality of ['high','standard']){
   await load('fleet',quality,55,-12);
   await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);
   const before=await snap(),start=Date.now();
   await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:700,y:440,button:'right',buttons:2,clickCount:1});
   for(let i=1;i<=60;i++){await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:700+i*2,y:440,button:'right',buttons:2});await c.sleep(16);}
   const after=await snap();performanceResults.push({quality,orbitFPS:(after.performance.frames-before.performance.frames)/((Date.now()-start)/1000),profile:after.performance.profile});
   await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:820,y:440,button:'right',clickCount:1});
 }
 await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await load('coach','standard',45,135);await shot('mobile-coach');
 assert.equal(await c.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
 writeFileSync(new URL('verification.json',dir),JSON.stringify({modelRevision,results,performanceResults},null,2));console.log(JSON.stringify({modelRevision,results,performanceResults},null,2));
}finally{
 await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:20,y:20,button:'left',clickCount:1}).catch(()=>{});
 await c.send('Emulation.clearDeviceMetricsOverride');
 await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);
 c.close();
}

