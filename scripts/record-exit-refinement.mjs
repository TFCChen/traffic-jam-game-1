import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]),out=process.argv[3],theme=process.argv[4]??'day';mkdirSync(out,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`),samples=[],errors=[];
const frames=[],frameDir='.browser-checks/exit-recording-'+Date.now();mkdirSync(frameDir,{recursive:true});
await c.send('Page.enable');
c.onEvent('Page.screencastFrame',e=>{const path=frameDir+'/'+String(frames.length).padStart(4,'0')+'.jpg';writeFileSync(path,Buffer.from(e.data,'base64'));frames.push({path,time:e.metadata.timestamp});c.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(e=>errors.push(String(e)));});
await c.send('Network.enable');await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setCacheDisabled',{cacheDisabled:true});await c.send('Runtime.enable');await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 const time=await c.evaluate('performance.timeOrigin'),cars=[{id:'target',color:'#e53935',row:2,col:0,len:2,dir:'H'}];
 await c.evaluate(`localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(Object.fromEntries(Array.from({length:40},(_,i)=>[i+1,{completed:true,stars:3,bestMoves:10}]))));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-exit',title:'出庫演出',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-exit',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:35,yaw:45,zoom:1.5,quality:'high',theme:'${theme}',motion:1.2}));location.reload()`);
 await c.until(`performance.timeOrigin!==${time}&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'`);await c.sleep(500);
 assert.equal((await snap()).settings.theme,theme);
 await c.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:900,everyNthFrame:2});
 await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);
 const p=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection;for(const h of [.45,.6,.8]){const from=a.project(1,h,2.5);if(a.pick(from.x,from.y)==='target')return{from,to:a.project(5,h,2.5)};}throw Error('Unpickable target')})()`);
 await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p.from,button:'left',buttons:1,clickCount:1});
 for(let i=1;i<=12;i++){await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.from.x+(p.to.x-p.from.x)*i/12,y:p.from.y+(p.to.y-p.from.y)*i/12,button:'left',buttons:1});await c.sleep(25);}
 await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p.to,button:'left',buttons:0});
 for(let i=0;i<44;i++){
   const s=await snap();samples.push({exit:s.exit,car:s.cars[0],shadowUpdates:s.performance.shadowUpdates,frames:s.performance.frames});
   if(i%4===0)writeFileSync(out+`/frame-${String(i).padStart(2,'0')}.png`,Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
   await c.sleep(110);
 }
 await c.send('Page.stopScreencast');writeFileSync(out+'/recording-frames.json',JSON.stringify(frames));
 const final=await snap();assert.deepEqual(errors,[]);assert(samples.some(s=>s.exit.yaw<-.5));writeFileSync(out+'/inspection.json',JSON.stringify({theme,samples,performance:final.performance,errors},null,2));console.log('Exit video and shadow/pose samples captured');
}finally{
 await c.send('Page.stopScreencast').catch(()=>{});
 await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
