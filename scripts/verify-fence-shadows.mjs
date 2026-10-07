import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]);
const dir=new URL('../docs/fence-shadow-2026-10-07/',import.meta.url);mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const progress=Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,{completed:true,stars:3,bestMoves:10}]));
const errors=[],reports=[];
await c.send('Runtime.enable');
c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
c.onEvent('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
async function shot(name){writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));}
async function drag(x,y,dx,dy,button){
  const buttons=button==='right'?2:4;
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button,buttons});
  for(let i=1;i<=8;i++){await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx*i/8,y:y+dy*i/8,button,buttons});await c.sleep(70);}
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button,buttons:0});await c.sleep(200);
}
try{
  const cases=[['day','high',55,35,1440,1000],['standard','standard',45,-65,1440,1000],['sunset','high',35,120,1440,1000],['neon','high',55,35,1440,1000],['mobile','high',75,0,390,844]];
  for(const[name,quality,pitch,yaw,width,height]of cases){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    const settings={pitch,yaw,zoom:1.2,quality,theme:['sunset','neon'].includes(name)?name:'day'};
    const origin=await c.evaluate('performance.timeOrigin');
    await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(${JSON.stringify(progress)}));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify(${JSON.stringify(settings)}));location.reload()`);
    await c.until(`performance.timeOrigin!==${origin}`);await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready`);await c.sleep(1000);
    const before=await snap();await shot(name+'-before');
    if(width>500){
      await drag(width/2,height*.45,56,16,'right');await shot(name+'-orbit');
      const rotated=await snap();assert.notEqual(rotated.settings.yaw,before.settings.yaw);
      await drag(width/2,height*.45,55,20,'middle');
      const moved=await snap();assert.notEqual(moved.settings.panX,rotated.settings.panX);
      await c.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:width/2,y:height*.45,deltaX:0,deltaY:-90});await c.sleep(300);
    }else{
      await c.send('Emulation.setTouchEmulationEnabled',{enabled:true});
      await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:180,y:150},{id:2,x:240,y:150}]});
      for(let i=1;i<=8;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:180+i*2,y:150+i},{id:2,x:240+i*3,y:150+i}]});await c.sleep(70);}
      await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.sleep(300);
      await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    }
    const after=await snap();await shot(name+'-after');
    assert.equal(before.settings.theme,settings.theme,'Requested theme must be unlocked in the fixture');
    assert.equal(after.performance.shadowUpdates,before.performance.shadowUpdates,'Camera movement must not rebuild fixed world shadows');
    assert(after.settings.shadows);assert.equal(after.cars.length,8);
    reports.push({name,before:before.settings,after:after.settings,shadowUpdatesDuringMovement:after.performance.shadowUpdates-before.performance.shadowUpdates});
  }
  assert.deepEqual(errors,[]);writeFileSync(new URL('inspection.json',dir),JSON.stringify({reports,errors},null,2));console.log(JSON.stringify({reports,errors}));
}finally{
  await c.send('Emulation.clearDeviceMetricsOverride');
  await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
