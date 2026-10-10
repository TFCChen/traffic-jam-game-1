import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { connect } from './cdp-test.mjs';
const c=await connect(process.argv[2]),dir=new URL(process.env.VERIFY_OUTPUT_DIR??'../docs/ground-2026-10-07/',import.meta.url);mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
await c.send('Runtime.enable');await c.send('Network.enable');await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setCacheDisabled',{cacheDisabled:true});
await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.bringToFront');
const errors=[];c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));c.onEvent('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
async function load(settings,unlocked=true){
  const origin=await c.evaluate('performance.timeOrigin'),progress=unlocked?Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,{completed:true,stars:3,bestMoves:10}])):{};
  await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(${JSON.stringify(progress)}));localStorage.setItem('traffic-jam-scene',JSON.stringify(${JSON.stringify(settings)}));location.reload()`);
  await c.until(`performance.timeOrigin!==${origin}`);await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready`);await c.sleep(900);
}
async function shot(name){writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));}
const reports=[];
try{
  for(const[name,width,height,pitch,yaw,zoom,theme,focusX=0,focusZ=0,quality='high']of[
    ['dry',1440,1000,55,25,.85,'day'],['rain',1440,1000,55,25,.85,'rain'],
    ['road-dry',1440,1000,35,-55,2.5,'day',5,2.4],['road-wet',1440,1000,35,-55,2.5,'rain',5,2.4],
    ['car-dry',1440,1000,40,25,3.5,'day',0,-.5],['car-wet',1440,1000,40,25,3.5,'rain',0,-.5],
    ['rain-glint',1440,1000,55,140,.85,'rain'],['rain-cafe',1440,1000,35,70,2,'rain',-3.7,-1.9],['sunset',1440,1000,55,25,.85,'sunset'],
    ['night',1440,1000,55,25,.85,'neon'],['rain-overhead',1440,1000,90,0,1,'rain'],
    ['mobile-rain',393,844,70,0,1,'rain'],['rain-saver',393,844,70,0,1,'rain',0,0,'saver']]){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:width<500?3:1,mobile:width<500});
    await load({pitch,yaw,zoom,theme,focusX,focusZ,quality});await shot(name);
    const s=await snap();assert.equal(s.groundSurface.wet,theme==='rain');assert.equal(s.rainSurfaces.wet,theme==='rain');assert.equal(s.groundSurface.reflectionPassesPerFrame,0);assert.equal(s.cars.length,8);
    for(const kind of ['paint','glass','leaf','bark','metal','scenery'])assert(s.rainSurfaces.kinds.includes(kind));
    reports.push({name,settings:s.settings,ground:s.groundSurface,rainSurfaces:s.rainSurfaces,performance:s.performance});
  }
  await c.send('Emulation.clearDeviceMetricsOverride');await load({pitch:65,yaw:0,zoom:1,quality:'high',theme:'day'},false);
  await c.click('車庫設定');const rainPoint=await c.evaluate(`(()=>{const b=[...document.querySelectorAll('.scene-themes button')].find(b=>b.textContent.includes('雨後街景'));if(!b||b.disabled)throw Error('Rain theme must be available from the start');const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,...rainPoint,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
  await c.until(`document.querySelector('.garage-canvas').garageInspection.snapshot().settings.theme==='rain'`);await c.sleep(600);
  assert.equal(await c.evaluate(`document.querySelectorAll('.scene-themes button[aria-pressed="true"]').length`),1);
  await shot('rain-settings');await c.click('關閉車庫設定');await c.sleep(800);assert((await snap()).groundSurface.wet);
  const idle=await c.evaluate(readFileSync(new URL('./check-scene-performance.js',import.meta.url),'utf8'));
  const profiles=[];
  for(const[name,width,height,dpr,theme]of [['dry',1440,1000,1,'day'],['wet',1440,1000,1,'rain'],['mobile-wet',393,844,3,'rain']]){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:width<500});await load({pitch:65,yaw:25,zoom:.85,quality:'high',theme});
    await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);await c.sleep(5000);const s=await snap();profiles.push({name,ground:s.groundSurface,performance:s.performance});await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(false)`);
  }
  for(const theme of ['day','rain']){
    await c.send('Emulation.clearDeviceMetricsOverride');
    await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await load({pitch:65,yaw:25,zoom:.85,quality:'high',theme});
    await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);
    await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:1260,y:420,button:'right',buttons:2,clickCount:1});
    for(let i=0;i<180;i++){
      await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1260+Math.sin(i*.055)*110,y:420+Math.sin(i*.03)*45,button:'right',buttons:2});await c.sleep(25);
    }
    await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:1260,y:420,button:'right',buttons:0});
    const s=await snap();assert(Math.abs(s.settings.yaw-25)>5,'Orbit benchmark must actually rotate the camera');
    profiles.push({name:theme==='rain'?'wet-orbit':'dry-orbit',ground:s.groundSurface,performance:s.performance});
    await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(false)`);
  }
  assert.deepEqual(errors,[]);writeFileSync(new URL('inspection.json',dir),JSON.stringify({reports,idle,profiles,rainSelectableWithoutProgress:true,errors},null,2));console.log(JSON.stringify({views:reports.length,rainSelection:true,idle,errors}));
}finally{
  await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
