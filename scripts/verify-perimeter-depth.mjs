import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]),dir='docs/perimeter-depth-2026-10-07';mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const baseline=readFileSync(process.argv[3]??'.browser-checks/plinth-before.glb').toString('base64');
const fixed=readFileSync('public/models/garage.glb').toString('base64');
let modelBody=baseline,intercepted=0;const errors=[],reports=[];
await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setCacheDisabled',{cacheDisabled:true});
c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.text));
c.onEvent('Fetch.requestPaused',async e=>{
  try{intercepted++;await c.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'model/gltf-binary'}],body:modelBody});}catch(error){errors.push(String(error));}
});
await c.send('Fetch.enable',{patterns:[{urlPattern:'*/models/garage.glb*'}]});
const points=[[-.08,1.3],[-.08,3.3],[-.08,4.9],[6.08,1.3],[6.08,4.1],[6.08,5.1],[1.3,-.08],[3.3,-.08],[4.9,-.08],[1.3,6.08],[3.3,6.08],[4.9,6.08]];
try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:960,height:960,deviceScaleFactor:1,mobile:false});
 for(const name of ['baseline','fixed']){
  modelBody=name==='baseline'?baseline:fixed;
  for(const yaw of [-60,-40,-20,0,20,40,60]){
   const time=await c.evaluate('performance.timeOrigin');
   await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:45,yaw:${yaw},zoom:1.2,shadows:false,quality:'high',theme:'day'}));location.reload()`);
   await c.until(`performance.timeOrigin!==${time}`);await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready`);await c.sleep(400);
   const png=(await c.send('Page.captureScreenshot')).data;writeFileSync(`${dir}/${name}-${yaw}.png`,Buffer.from(png,'base64'));
   const samples=await c.evaluate(`(async()=>{const img=await createImageBitmap(new Blob([Uint8Array.from(atob('${png}'),v=>v.charCodeAt(0))],{type:'image/png'}));const canvas=new OffscreenCanvas(img.width,img.height),ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return ${JSON.stringify(points)}.map(([x,z])=>{const p=document.querySelector('.garage-canvas').garageInspection.project(x,0,z),d=ctx.getImageData(Math.round(p.x)-1,Math.round(p.y)-1,3,3).data;return {point:[x,z],screen:p,rgb:[0,1,2].map(k=>Array.from({length:9},(_,i)=>d[i*4+k]).reduce((a,b)=>a+b)/9)}})})()`);
   reports.push({name,yaw,samples});
  }
 }
 assert.equal(intercepted,14,'Both model variants must actually pass through the interception fixture');assert.deepEqual(errors,[]);
 const ranges={};
 for(const name of ['baseline','fixed'])ranges[name]=points.map((point,index)=>{const levels=reports.filter(r=>r.name===name).map(r=>r.samples[index].rgb.reduce((a,b)=>a+b)/3);return {point,min:Math.min(...levels),max:Math.max(...levels),range:Math.max(...levels)-Math.min(...levels)};});
 writeFileSync(`${dir}/depth-comparison.json`,JSON.stringify({reports,ranges,intercepted,errors},null,2));console.log(JSON.stringify({ranges,intercepted,errors}));
}finally{
 await c.send('Fetch.disable');await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
