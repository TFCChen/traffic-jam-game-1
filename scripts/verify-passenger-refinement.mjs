import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync}from'node:fs';
import {connect}from'./cdp-test.mjs';
const c=await connect(process.argv[2]),out='docs/exit-refinement-2026-10-08/passenger';mkdirSync(out,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`),errors=[],results=[];
await c.send('Runtime.enable');await c.send('Network.enable');await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setCacheDisabled',{cacheDisabled:true});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const shot=async name=>writeFileSync(out+'/'+name+'.png',Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 for(const[kind,color]of [['compact','#38bdf8'],['jeep','#43a047']])for(const theme of ['day','sunset']){
  const cars=[{id:'target',color:'#e53935',row:2,col:0,len:2,dir:'H'},{id:'detail',color,row:4,col:1,len:2,dir:'H'}],time=await c.evaluate('performance.timeOrigin');
  await c.evaluate(`localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(Object.fromEntries(Array.from({length:40},(_,i)=>[i+1,{completed:true,stars:3,bestMoves:10}]))));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-passenger',title:'車輛燈具檢查',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-passenger',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:30,yaw:135,zoom:3,focusX:-1,focusZ:1.5,quality:'high',theme:'${theme}',motion:1.2}));location.reload()`);
  await c.until(`performance.timeOrigin!==${time}&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'`);await c.sleep(500);
  assert.equal((await snap()).cars.find(car=>car.id==='detail').model,kind);assert.equal((await snap()).settings.theme,theme);await shot(kind+'-'+theme);
  const p=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection;for(const h of [.5,.7,.9]){const from=a.project(2,h,4.5);if(a.pick(from.x,from.y)==='detail')return{from,to:a.project(3,h,4.5)};}throw Error('Unpickable detail')})()`);
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p.from,button:'left',buttons:1,clickCount:1});
  for(let i=1;i<=12;i++){await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.from.x+(p.to.x-p.from.x)*i/12,y:p.from.y+(p.to.y-p.from.y)*i/12,button:'left',buttons:1});await c.sleep(30);}
  await shot(kind+'-'+theme+'-lamps');await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p.to,button:'left',buttons:0});await c.until(`document.querySelector('.stats b').textContent==='1'`);
  assert(Math.abs((await snap()).cars.find(car=>car.id==='detail').wheelAngle)>.1);results.push({kind,theme,drag:true,lights:(await snap()).vehicleLights});await c.click('復原');await c.until(`document.querySelector('.stats b').textContent==='0'`);
 }
 assert.deepEqual(errors,[]);writeFileSync(out+'/inspection.json',JSON.stringify({results,errors},null,2));console.log('Compact/jeep day/sunset close views, native drags, wheel rotation and undo passed');
}finally{await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();}
