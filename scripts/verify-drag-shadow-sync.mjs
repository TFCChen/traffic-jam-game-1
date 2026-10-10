import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]),out=process.argv[3];mkdirSync(out,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`),results=[],errors=[];
await c.send('Runtime.enable');await c.send('Network.enable');await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setCacheDisabled',{cacheDisabled:true});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
try{
 for(const touch of[false,true])for(const theme of['day','sunset']){
  await c.send('Emulation.setDeviceMetricsOverride',{width:touch?430:1280,height:touch?932:900,deviceScaleFactor:1,mobile:touch});await c.send('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:5});
  const time=await c.evaluate('performance.timeOrigin'),cars=[{id:'target',color:'#e53935',row:2,col:0,len:2,dir:'H'},{id:'detail',color:'#38bdf8',row:4,col:1,len:2,dir:'H'}];
  await c.evaluate(`localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(Object.fromEntries(Array.from({length:40},(_,i)=>[i+1,{completed:true,stars:3,bestMoves:10}]))));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-shadow',title:'快速拖動陰影檢查',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-shadow',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:65,yaw:0,zoom:1,quality:'high',theme:'${theme}',shadows:true,motion:1.2}));location.reload()`);
  await c.until(`performance.timeOrigin!==${time}&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'`);await c.sleep(600);
  const initial=await snap();assert(initial.performance.shadows);assert.equal(initial.settings.theme,theme);
  const p=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection;for(const h of [.45,.6,.8]){const from=a.project(2,h,4.5);if(a.pick(from.x,from.y,'${touch?'touch':'mouse'}')==='detail')return{from,unit:a.project(3,h,4.5)};}throw Error('Car not pickable')})()`);
  const input=async(type,x,y)=>touch?c.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,radiusX:4,radiusY:4,force:1}]}):c.send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1});
  await input(touch?'touchStart':'mousePressed',p.from.x,p.from.y);
  for(let i=1;i<=48;i++){
   const delta=.9+1.4*Math.sin(i*Math.PI/8),x=p.from.x+(p.unit.x-p.from.x)*delta,y=p.from.y+(p.unit.y-p.from.y)*delta;
   await input(touch?'touchMove':'mouseMoved',x,y);await c.sleep(8);
   if(i===30)writeFileSync(out+`/${touch?'touch':'mouse'}-${theme}-drag.png`,Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
  }
  await input(touch?'touchEnd':'mouseReleased',p.unit.x,p.unit.y);await c.sleep(700);
  const final=await snap(),moving=final.performance.movingFrames-initial.performance.movingFrames,matched=final.performance.movingShadowFrames-initial.performance.movingShadowFrames;
  assert(moving>12,'Fast repeated drags must produce enough rendered moving poses');assert.equal(moving,matched,'Every moving pose must submit a matching sun shadow depth');
  // Suspension and brake-light transitions can still move the shadow after
  // release. Check caching once that settling has actually had time to finish.
  await c.sleep(1600);const idleBefore=(await snap()).performance.shadowUpdates;await c.sleep(500);const idleAfter=(await snap()).performance.shadowUpdates;assert(idleAfter-idleBefore<3,'Stopped vehicles must retain shadow caching');
  results.push({touch,theme,moving,matched,idleUpdates:idleAfter-idleBefore});
 }
 assert.deepEqual(errors,[]);writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));console.log('Fast native mouse/touch drags: every moving pose submits matching shadows; stopped poses stay cached');
}finally{
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
