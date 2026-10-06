import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { connect } from './cdp-test.mjs';
import { VEHICLE_GROUND_HEIGHT } from '../src/contactShadow.js';
const c=await connect(process.argv[2]);
const dir=new URL('../docs/wheel-arch-fix-2026-10-06/',import.meta.url);
mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const shot=async name=>writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
try {
  await c.send("Emulation.setFocusEmulationEnabled",{enabled:true});
  await c.send("Page.bringToFront");
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
  const cars=[{id:'target',color:'#e54848',row:2,col:1,len:2,dir:'H'}];
  const origin=await c.evaluate('performance.timeOrigin');
  await c.evaluate(`localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-contact',title:'輪拱與接地檢查',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-contact',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:23,yaw:180,zoom:3,focusX:-1,focusZ:-.5,quality:'high',theme:'day',shadows:true,intensity:3,motion:1.2}));location.reload()`);
  await c.until(`performance.timeOrigin!==${origin}&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready===true`);
  await c.sleep(400);
  assert.equal((await snap()).cars[0].position[1],VEHICLE_GROUND_HEIGHT);
  await shot('low-side');
  const points=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection,[x,,z]=a.snapshot().cars[0].position;for(const h of [.3,.5,.7])for(const offset of [0,.25,-.25]){const from=a.project(x+offset,h,z);if(a.pick(from.x,from.y)==='target'&&document.elementFromPoint(from.x,from.y)===document.querySelector('.garage-canvas'))return {from,to:a.project(x+offset+1,h,z)};}throw Error('Car not pickable');})()`);
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:points.from.x,y:points.from.y,button:'left',buttons:1,clickCount:1});
  for(let i=1;i<=20;i++) {await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',x:points.from.x+(points.to.x-points.from.x)*i/20,y:points.from.y+(points.to.y-points.from.y)*i/20,buttons:1});await c.sleep(20);}
  await shot('during-drag');
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:points.to.x,y:points.to.y,button:'left',clickCount:1});
  await c.until(`document.querySelector('.stats b').textContent==='1'`);
  await c.sleep(800);
  await c.until(`Math.abs(document.querySelector('.garage-canvas').garageInspection.snapshot().cars[0].tilt)<.001`);
  const stopped=await snap();assert.equal(stopped.cars[0].position[1],VEHICLE_GROUND_HEIGHT);
  await shot('stopped');
  await c.click('復原');assert.equal(await c.evaluate(`document.querySelector('.stats b').textContent`),'0');
  for(const [name,pitch,yaw]of [['oblique-top',65,145],['opposite-side',30,0]]) {
    const previousOrigin=await c.evaluate('performance.timeOrigin');
    await c.evaluate(`localStorage.setItem('traffic-jam-scene',JSON.stringify({...JSON.parse(localStorage.getItem('traffic-jam-scene')),pitch:${pitch},yaw:${yaw}}));location.reload()`);
    await c.until(`performance.timeOrigin!==${previousOrigin}&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready===true`);
    await c.sleep(800);await shot(name);
  }
  writeFileSync(new URL('contact-verification.json',dir),JSON.stringify({groundHeight:VEHICLE_GROUND_HEIGHT,stoppedTilt:stopped.cars[0].tilt,stoppedCompression:stopped.cars[0].compression,actualDragAndUndo:true},null,2));
  console.log('Low-angle picking, one-cell drag, settled suspension and undo passed.');
} finally {
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:20,y:20,button:'left',clickCount:1}).catch(()=>{});
  await c.send('Emulation.clearDeviceMetricsOverride');
  await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);
  c.close();
}


