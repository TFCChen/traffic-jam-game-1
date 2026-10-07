import {connect} from './cdp-test.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const c=await connect(process.argv[2]),dir='docs/stable-shadow-2026-10-07/phase';mkdirSync(dir,{recursive:true});
const hashes={};
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
await c.send('Page.enable');await c.send('Network.enable');await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setCacheDisabled',{cacheDisabled:true});
try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:393,height:844,deviceScaleFactor:3,mobile:true});
 for(const stable of [false,true])for(const phase of [0,17]){
  const {identifier}=await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.patchedShaders=0;const original=WebGL2RenderingContext.prototype.shaderSource;WebGL2RenderingContext.prototype.shaderSource=function(shader,source){if(source.includes('courtyard-stable-PCF')){window.patchedShaders++;if(!${stable})source=source.replaceAll('float phi = 0.0; // courtyard-stable-PCF','float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;');source=source.replaceAll('interleavedGradientNoise( gl_FragCoord.xy )','interleavedGradientNoise( gl_FragCoord.xy + vec2(${phase}.0, ${phase+7}.0) )');}return original.call(this,shader,source)}})()`});
  const time=await c.evaluate('performance.timeOrigin');
  await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:45,yaw:-25,zoom:1.3,shadows:true,quality:'high',theme:'day'}));location.reload()`);
  await c.until(`performance.timeOrigin!==${time}`);await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready`);await c.sleep(750);
  const png=Buffer.from((await c.send('Page.captureScreenshot')).data,'base64');
  const name=`${stable?'fixed':'rotating'}-${phase}`;
  writeFileSync(`${dir}/${name}.png`,png);
  const patchedShaders=await c.evaluate('window.patchedShaders');assert(patchedShaders>0,'Fixture must intercept the actual compiled PCF shader');
  console.log({stable,phase,patchedShaders});
  const corners=await c.evaluate(`[[1.3,.04,-.08],[3.75,.04,-.08],[3.75,.04,.4],[1.3,.04,.4]].map(p=>document.querySelector('.garage-canvas').garageInspection.project(...p))`);
  // Mask just the empty fence strip; idle vehicle effects outside it may vary
  // with wall-clock timing between reloads and are not shadow-filter changes.
  hashes[name]=await c.evaluate(`(async()=>{const image=await createImageBitmap(new Blob([Uint8Array.from(atob('${png.toString('base64')}'),v=>v.charCodeAt(0))],{type:'image/png'}));const canvas=new OffscreenCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);ctx.globalCompositeOperation='destination-in';ctx.beginPath();${JSON.stringify(corners)}.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x*3,p.y*3));ctx.closePath();ctx.fill();const hash=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,canvas.width,canvas.height).data);return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')})()`);
  writeFileSync(dir+'/roi.json',JSON.stringify(corners));
  await c.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
 }
 assert.notEqual(hashes['rotating-0'],hashes['rotating-17'],'Screen-space noise changes the same scene when sampling phase moves');
 assert.equal(hashes['fixed-0'],hashes['fixed-17'],'Stable kernel must render identical images at both screen sampling phases');
 writeFileSync(dir+'/hashes.json',JSON.stringify(hashes,null,2));
}finally{
 await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
