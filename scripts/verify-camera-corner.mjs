import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]),out=process.env.VERIFY_OUTPUT_DIR??'docs/camera-corner-2026-10-08/before';mkdirSync(out,{recursive:true});
const expr="document.querySelector('.garage-canvas').garageInspection.snapshot()",snap=()=>c.evaluate(expr);
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`),reports=[];
try{
 await c.send('Network.enable');await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setCacheDisabled',{cacheDisabled:true});
 await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 for(const [pitch,px,py]of [[30,7,4],[55,-7,4],[90,7,-4]]){
 const old=await c.evaluate('performance.timeOrigin');
 await c.evaluate(`localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:${pitch},yaw:170,zoom:4,panX:${px},panY:${py},theme:'day',quality:'high'}));location.reload()`);
 await c.until(`performance.timeOrigin!==${old}&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready`);await c.sleep(700);
 const initial=await snap(),samples=[];
 // Multiple drags cover more than one full rotation, both directions.
 for(const direction of [-1,1])for(let drag=0;drag<4;drag++){
 let x=direction<0?1260:300;const y=460;
 await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'right',buttons:2});
 for(let step=0;step<45;step++){x+=direction*18;await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'right',buttons:2});await c.sleep(25);const s=await snap();samples.push({center:s.viewCenter,view:s.settings,width:s.cameraFrustum.width});}
 await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'right',buttons:0});await c.sleep(150);const s=await snap();samples.push({center:s.viewCenter,view:s.settings,width:s.cameraFrustum.width,released:true});
 }
 const maxDrift=Math.max(...samples.map(s=>Math.hypot(s.center[0]-initial.viewCenter[0],s.center[2]-initial.viewCenter[2])));
 reports.push({pitch,initialCenter:initial.viewCenter,maxDrift,samples});console.log({pitch,maxDrift});
 if(process.env.VERIFY_ASSERT==='1'){assert(maxDrift<.0001,'Screen-center pivot must not jump near pan limits');assert(samples.every(s=>Math.abs(s.width-initial.cameraFrustum.width)<1e-8),'Orbit must not zoom');}
 }
 writeFileSync(out+'/inspection.json',JSON.stringify(reports,null,2));
}finally{await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();}
