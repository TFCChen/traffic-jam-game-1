import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { connect } from './cdp-test.mjs';
const c = await connect(process.argv[2]);
const dir = new URL('../docs/foliage-2026-10-07/', import.meta.url); mkdirSync(dir, { recursive: true });
const saved = await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
await c.send('Runtime.enable'); await c.send('Network.enable'); await c.send('Network.setBypassServiceWorker',{bypass:true}); await c.send('Network.setCacheDisabled',{cacheDisabled:true});
await c.send('Emulation.setFocusEmulationEnabled',{enabled:true}); await c.send('Page.bringToFront');
const errors=[]; c.onEvent('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.text));
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
async function load(settings) {
  const origin=await c.evaluate('performance.timeOrigin');
  const progress=Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,{completed:true,stars:3,bestMoves:10}]));
  await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(${JSON.stringify(progress)}));localStorage.setItem('traffic-jam-scene',JSON.stringify(${JSON.stringify(settings)}));location.reload()`);
  await c.until(`performance.timeOrigin!==${origin}`);await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready`);await c.sleep(700);
}
async function shot(name){writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));}
const close={pitch:45,yaw:-30,zoom:4,focusX:-3.68,focusZ:2.6,quality:'high',theme:'day'};
const old=spawnSync('git',['show','HEAD:public/models/garage.glb'],{maxBuffer:10e6});assert.equal(old.status,0);
let interceptionError;
c.onEvent('Fetch.requestPaused', async e=>{try{await c.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'model/gltf-binary'}],body:old.stdout.toString('base64')});}catch(error){interceptionError=error;}});
try{
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await c.send('Fetch.enable',{patterns:[{urlPattern:'*garage.glb*'}]});await load(close);await shot('before-close');await c.send('Fetch.disable');assert(!interceptionError);
  const reports=[];
  for(const[name,pitch,yaw,theme]of [['after-close',45,-30,'day'],['after-overhead',90,0,'day'],['after-side',30,-60,'day'],['after-sunset',45,-30,'sunset'],['after-night',45,-30,'neon']]){
    await load({...close,pitch,yaw,theme});await shot(name);const s=await snap();assert.equal(s.cars.length,8);assert(s.atmosphere.enabled);reports.push({name,settings:s.settings,atmosphere:s.atmosphere,performance:s.performance});
  }
  await c.send('Emulation.setDeviceMetricsOverride',{width:393,height:844,deviceScaleFactor:3,mobile:true});await load({pitch:65,yaw:25,zoom:.85,quality:'high',theme:'day'});await shot('mobile');
  const performance=await c.evaluate(readFileSync(new URL('./check-scene-performance.js',import.meta.url),'utf8'));assert.deepEqual(errors,[]);
  writeFileSync(new URL('inspection.json',dir),JSON.stringify({reports,performance,errors},null,2));console.log(JSON.stringify({views:reports.length+2,performance,errors}));
}finally{
  await c.send('Fetch.disable');await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
