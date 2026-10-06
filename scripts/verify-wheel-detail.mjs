import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]);
const stage=process.argv[3]??'after';
const dir=new URL('../docs/wheel-detail-2026-10-06/',import.meta.url);
mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const errors=[];
await c.send('Runtime.enable');
c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.text));
c.onEvent('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const ready=()=>c.until(`(()=>{const a=document.querySelector('.garage-canvas'),s=a?.garageInspection?.snapshot();return s?.ready&&s.sceneKey===s.performance.renderedSceneKey&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'})()`);
const shot=async name=>writeFileSync(new URL(stage+'-'+name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
async function reload(code){const origin=await c.evaluate('performance.timeOrigin');await c.evaluate(code+';location.reload()');await c.until(`performance.timeOrigin!==${origin}`);await ready();await c.sleep(600);}
async function drag(id,touch=false){
  const p=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection,car=a.snapshot().cars.find(c=>c.id==='${id}'),[x,,z]=car.position;for(const h of [.5,.3,.7]){const from=a.project(x,h,z);if(a.pick(from.x,from.y)==='${id}')return {from,to:a.project(x+1,h,z)};}throw Error('Unpickable car');})()`);
  const input=async(type,x,y)=>touch?c.send('Input.dispatchTouchEvent',{type:({mousePressed:'touchStart',mouseMoved:'touchMove',mouseReleased:'touchEnd'})[type],touchPoints:type==='mouseReleased'?[]:[{x,y,id:1,radiusX:5,radiusY:5}]}):c.send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:type==='mousePressed'?1:0});
  await input('mousePressed',p.from.x,p.from.y);
  for(let i=1;i<=24;i++){await input('mouseMoved',p.from.x+(p.to.x-p.from.x)*i/24,p.from.y+(p.to.y-p.from.y)*i/24);await c.sleep(30);}
  await input('mouseReleased',p.to.x,p.to.y);
  await c.until(`document.querySelector('.stats b').textContent==='1'`);
  assert.ok(Math.abs((await snap()).cars.find(car=>car.id===id).wheelAngle)>.1,'Tyres and rims must actually rotate during the drag');
  await c.click('復原');await c.until(`document.querySelector('.stats b').textContent==='0'`);
}
try{
  await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.bringToFront');
  const results=[];
  for(const [device,width,height]of [['desktop',1440,950],['mobile',390,844]]){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:device==='mobile'});
    await reload(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:65,yaw:0,zoom:1,quality:'high',theme:'day',shadows:true,intensity:3,motion:1.2}))`);
    await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);
    await c.until(`document.querySelector('.garage-canvas').garageInspection.snapshot().performance.profile.cpuMs.samples>=40`);
    const s=await snap();results.push({device,profile:s.performance.profile,calls:s.calls,memory:s.memory,geometryVersion:await c.evaluate(`performance.getEntriesByType('resource').find(r=>r.name.includes('racer.glb'))?.name`)});
    await shot(device+'-board');
  }
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
  for(const [name,id,color,len]of (stage==='before'?[['racer','target','#e54848',2]]:[['racer','target','#e54848',2],['jeep','detail','#43a047',2],['compact','detail','#38bdf8',2],['coach','detail','#2563eb',3]])){
    const cars=[{id:'target',color:'#e54848',row:2,col:id==='target'?1:0,len:2,dir:'H'},...(id==='target'?[]:[{id,color,row:4,col:1,len,dir:'H'}])];
    await reload(`localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-wheel-detail',title:'輪胎與煞車檢查',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-wheel-detail',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:30,yaw:180,zoom:3,focusX:${len===3?-.5:-1},focusZ:${id==='target'?-.5:1.5},quality:'high',theme:'day',shadows:true,intensity:3,motion:1.2}))`);
    assert.equal((await snap()).cars.find(car=>car.id===id)?.model,name,'The intended vehicle must be present in the screenshot fixture');
    await shot(name+'-side');
    if(id==='target'){
      await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);await drag(id);
      results.push({actualDragAndUndo:true,dragPerformance:(await snap()).performance});
      if(stage==='after'){
        await reload(`localStorage.setItem('traffic-jam-scene',JSON.stringify({...JSON.parse(localStorage.getItem('traffic-jam-scene')),pitch:60,yaw:145}))`);
        await shot('racer-top');
      }
    }
  }
  if(stage==='after'){
    await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    const cars=[{id:'target',color:'#e54848',row:2,col:1,len:2,dir:'H'}];
    await reload(`localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-wheel-detail',title:'手機輪胎檢查',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-wheel-detail',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:65,yaw:0,zoom:1.7,focusX:-1,focusZ:-.5,quality:'high',theme:'day',shadows:true,intensity:3,motion:1.2}))`);
    await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);await drag('target',true);
    results.push({actualTouchDragAndUndo:true,dragPerformance:(await snap()).performance});await shot('mobile-close');
  }
  assert.deepEqual(errors,[]);
  writeFileSync(new URL(stage+'-verification.json',dir),JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({stage,results,errors}));
}finally{
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',x:10,y:10}).catch(()=>{});
  await c.send('Emulation.clearDeviceMetricsOverride');
  await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);
  c.close();
}
