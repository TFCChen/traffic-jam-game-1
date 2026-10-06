import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]),dir=new URL('../docs/courtyard-2026-10-07/',import.meta.url);mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const ready=()=>c.until(`(()=>{const s=document.querySelector('.garage-canvas')?.garageInspection?.snapshot();return s?.ready&&s.sceneKey===s.performance.renderedSceneKey})()`);
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const progress=Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,{completed:true,stars:3,bestMoves:10}]));
const errors=[];await c.send('Runtime.enable');c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));c.onEvent('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
async function reload(settings){const t=await c.evaluate('performance.timeOrigin');await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(${JSON.stringify(progress)}));localStorage.setItem('traffic-jam-scene',JSON.stringify(${JSON.stringify(settings)}));location.reload()`);await c.until(`performance.timeOrigin!==${t}`);await ready();await c.sleep(700);}
async function shot(name){writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));}
try {
 await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.bringToFront');
 const cases=[['default',1440,1000,85,0,1,'day'],['full-courtyard',1440,1000,65,25,.65,'day'],['cafe-detail',1440,1000,45,70,2,'day',-3.7,-1.9],['sunset',1440,1000,55,25,.85,'sunset'],['night',1440,1000,55,25,.85,'neon'],['low-angle',1440,1000,25,70,.8,'day'],['reverse-angle',1440,1000,50,-120,.8,'day'],['mobile',390,844,85,0,1,'day']];
 const reports=[];
 for(const [name,width,height,pitch,yaw,zoom,theme,focusX=0,focusZ=0]of cases){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
  await reload({pitch,yaw,zoom,focusX,focusZ,quality:'high',theme,motion:1.2});await shot(name);
  const s=await snap();assert(s.ready&&s.cars.length===8);assert.equal(s.settings.theme,theme);reports.push({name,settings:s.settings,performance:s.performance});
 }
 await c.send('Emulation.clearDeviceMetricsOverride');await reload({pitch:65,yaw:0,zoom:1,quality:'high',theme:'day',motion:1.2});
 const performanceResult=await c.evaluate(readFileSync(new URL('./check-scene-performance.js',import.meta.url),'utf8'));
 assert.deepEqual(errors,[]);writeFileSync(new URL('inspection.json',dir),JSON.stringify({reports,performance:performanceResult,errors},null,2));console.log(JSON.stringify({views:reports.length,performance:performanceResult,errors}));
}finally{
 await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
