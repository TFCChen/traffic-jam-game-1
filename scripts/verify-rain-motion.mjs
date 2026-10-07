import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]),dir=new URL('../docs/rain-motion-2026-10-08/',import.meta.url);
mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const errors=[];await c.send('Runtime.enable');await c.send('Network.enable');
await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setCacheDisabled',{cacheDisabled:true});
c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
c.onEvent('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
const expression=`document.querySelector('.garage-canvas').garageInspection.snapshot()`;
const snap=()=>c.evaluate(expression);
async function load(settings){
  const before=await c.evaluate('performance.timeOrigin');
  await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify(${JSON.stringify(settings)}));location.reload()`);
  await c.until(`performance.timeOrigin!==${before}`);
  await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready`);
  await c.until(`(()=>{const s=(${expression});return s.sceneKey===s.performance.renderedSceneKey&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'})()`);
  await c.sleep(650);
}
async function shot(name){writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));}
const reports=[];
try{
  await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.bringToFront');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const settings={pitch:45,yaw:70,zoom:3.5,focusX:-3.327,focusZ:-1.87,theme:'rain',quality:'high'};
  await load(settings);let s=await snap();
  assert.equal(s.atmosphere.rainMotion.sources.length,7);assert.equal(s.atmosphere.dripCapacity,14);
  assert(s.groundSurface.drainage&&s.atmosphere.residualDrips);
  const leaf=s.atmosphere.rainMotion.sources.find(p=>p.kind==='leaf');
  for(const [name,index,camera]of [['canopy',0,settings],['leaf',3,{...settings,pitch:50,yaw:-35,focusX:leaf.x-3,focusZ:leaf.z-3}]]){
    if(name==='leaf')await load(camera);
    s=await snap();const source=s.atmosphere.rainMotion.sources[index],flight=Math.sqrt(2*(source.y-source.floor)/6.2),offset=index*2.47+Math.sin(index*3)*.4;
    for(const [stage,lo,hi]of [['bead',.06,.24],['fall',.32+flight*.3,.32+flight*.7],['impact',.32+flight+.03,.32+flight+.18]]){
      await c.until(`(()=>{const t=(${expression}).atmosphere.rainMotion.time;const phase=(t+${offset})%19.3;return phase>${lo}&&phase<${hi}})()`,30000);
      const frame=await snap();assert(frame.atmosphere.rainMotion.active>0);await shot(name+'-'+stage);
      reports.push({name,stage,time:frame.atmosphere.rainMotion.time,source,active:frame.atmosphere.rainMotion.active});
    }
  }
  await load({...settings,pitch:65,yaw:25,zoom:.85,focusX:0,focusZ:0});await shot('normal-view');
  s=await snap();const before=s.groundSurface.flowTime;await c.sleep(500);assert((await snap()).groundSurface.flowTime>before);
  const enabledCalls=(await snap()).calls;
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await c.sleep(500);s=await snap();assert(!s.atmosphere.residualDrips&&!s.groundSurface.drainage);const frozen=s.groundSurface.flowTime;
  await c.sleep(400);assert.equal((await snap()).groundSurface.flowTime,frozen);await shot('reduced-motion');
  await c.send('Emulation.setEmulatedMedia',{features:[]});
  await load({...settings,quality:'saver'});s=await snap();assert(!s.atmosphere.residualDrips&&!s.groundSurface.drainage);
  await load({...settings,theme:'day'});s=await snap();assert(!s.atmosphere.residualDrips&&!s.groundSurface.drainage);
  await load({...settings,zoom:1,focusX:0,focusZ:0});await c.click('編輯器');
  await c.until(`(${expression}).sceneKey.includes('editor')`);await c.sleep(400);s=await snap();
  assert(!s.atmosphere.residualDrips&&!s.groundSurface.drainage);
  assert.deepEqual(errors,[]);writeFileSync(new URL('inspection.json',dir),JSON.stringify({reports,enabledCalls,reducedFreeze:true,saverDisabled:true,dryDisabled:true,editorDisabled:true,errors},null,2));
  console.log('Real canopy/leaf bead, fall, impact views; flowing gutter; dry/saver/reduced/editor disable passed');
}finally{
  await c.send('Emulation.setEmulatedMedia',{features:[]});await c.send('Emulation.clearDeviceMetricsOverride');
  await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
