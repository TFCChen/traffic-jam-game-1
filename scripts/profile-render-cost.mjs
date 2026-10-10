import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]);
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const dir=new URL('../docs/performance-2026-10-06/',import.meta.url);mkdirSync(dir,{recursive:true});
const cars=[['jeep','#62b447',0,0,2],['compact','#52a6da',0,2,2],['taxi','#965ad0',0,4,2],['pickup','#e9a83f',1,0,2],['delivery','#bc54d5',1,2,3],['target','#e54848',2,0,2],['schoolbus','#f2d451',3,0,3],['coach','#4875dc',4,0,3],['camper','#60b49a',5,0,3]].map(([id,color,row,col,len])=>({id,color,row,col,len,dir:'H'}));
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const results=[];
try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 for(const variant of [{name:'baseline'},{name:'no-shadows',shadows:false},{name:'no-glass',hideGlass:true},{name:'refractive-reference',optics:'refractive'}]){
  if(process.argv[4] && variant.name!==process.argv[4])continue;
  await c.evaluate(`localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(Object.fromEntries(Array.from({length:40},(_,i)=>[i+1,{completed:true,stars:1}]))));localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-perf',title:'效能量測',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-perf',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:55,yaw:-25,zoom:1.35,quality:'high',theme:'day',shadows:${variant.shadows!==false},intensity:3,motion:1.2}));location.reload()`);
  await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length===9`);
  await c.sleep(1500);
  if(variant.hideGlass)await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.probeGlass(true)`);
  if(variant.optics)await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.probeGlass('${variant.optics}')`);
  if(variant.pixelRatio)await c.send('Emulation.setDeviceMetricsOverride',{width:1000,height:665,deviceScaleFactor:1,mobile:false});
  await c.sleep(800);
  const p=await c.evaluate(`(()=>{const canvas=document.querySelector('.garage-canvas'),a=canvas.garageInspection,[x,,z]=a.snapshot().cars.find(c=>c.id==='target').position;for(const h of [.5,.7,1.05])for(const offset of [0,-.35,.35,-.7,.7]){const p=a.project(x+offset,h,z);if(document.elementFromPoint(p.x,p.y)===canvas&&a.pick(p.x,p.y)==='target')return p;}throw Error('Cannot pick target');})()`);
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});
  await c.sleep(700);
  await c.until(`document.querySelector('.garage-canvas').garageInspection.snapshot().cars.find(c=>c.id==='target').lampState.activity>0`);
  await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);
  const before=await snap(),start=Date.now();
  while(Date.now()-start<5000){await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+Math.sin((Date.now()-start)/220)*13,y:p.y,buttons:1});await c.sleep(33);}
  const after=await snap();
  results.push({name:variant.name,FPS:(after.performance.frames-before.performance.frames)/((Date.now()-start)/1000),profile:after.performance.profile});
  results.at(-1).raf=await c.evaluate(`new Promise(resolve=>{const start=performance.now();let count=0;function tick(){count++;const elapsed=performance.now()-start;if(elapsed<2000)requestAnimationFrame(tick);else resolve({callbacks:count,elapsed,FPS:count/(elapsed/1000),hidden:document.hidden});}requestAnimationFrame(tick);})`);
  writeFileSync(new URL(variant.name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
  console.log(JSON.stringify(results.at(-1)));
 }
 writeFileSync(new URL((process.argv[3]||'cost-breakdown')+'.json',dir),JSON.stringify(results,null,2));
}finally{
 await c.send('Emulation.clearDeviceMetricsOverride');
 await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}

