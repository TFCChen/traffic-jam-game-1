import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]),out=process.argv[3];
assert(out,'Provide an evidence directory');mkdirSync(out,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`),errors=[],reports=[];
await c.send('Runtime.enable');await c.send('Network.enable');await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setCacheDisabled',{cacheDisabled:true});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
c.onEvent('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
async function load(theme,camera,isolated=true){
  const origin=await c.evaluate('performance.timeOrigin'),cars=[{id:'target',color:'#e54848',row:2,col:1,len:2,dir:'H'}];
  await c.evaluate(`localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(Object.fromEntries(Array.from({length:40},(_,i)=>[i+1,{completed:true,stars:3,bestMoves:10}]))));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.removeItem('traffic-jam-session-v1');${isolated?`localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-refine',title:'模型檢查',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-refine',cars:${JSON.stringify(cars)},history:[],moves:0}}));`:''}localStorage.setItem('traffic-jam-scene',JSON.stringify(${JSON.stringify({pitch:55,yaw:25,zoom:.85,quality:'high',theme,shadows:true,intensity:3,motion:1.2,...camera})}));location.reload()`);
  await c.until(`performance.timeOrigin!==${origin}&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'`);await c.sleep(600);
  assert.equal((await snap()).settings.theme,theme);
}
async function shot(name){writeFileSync(out+'/'+name+'.png',Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));}
try{
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
  for(const theme of ['day','sunset'])for(const [view,pitch,yaw]of [['front-quarter',40,35],['front',35,145],['nose',25,90],['rear',25,-35]]){
    await load(theme,{pitch,yaw,zoom:3,focusX:-1,focusZ:-.5});assert.equal((await snap()).cars[0].model,'racer');await shot(theme+'-'+view);
  }
  for(const [name,w,h,mobile]of [['desktop',1440,950,false],['mobile',393,844,true]]){
    await c.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile});await load('day',{},false);
    await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);await c.sleep(4000);
    const s=await snap();reports.push({name,calls:s.calls,performance:s.performance});await shot(name+'-board');
  }
  const version=await c.evaluate(`fetch('/version.json',{cache:'no-store'}).then(r=>r.json())`);
  const modelUrl=await c.evaluate(`performance.getEntriesByType('resource').find(r=>r.name.includes('/racer.glb'))?.name`);
  assert(modelUrl,'The racer asset must be loaded');
  assert.deepEqual(errors,[]);writeFileSync(out+'/inspection.json',JSON.stringify({version,modelUrl,reports,errors},null,2));console.log('Racer front/rear/side views, day/sunset and desktop/mobile profiles passed');
}finally{
  await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
