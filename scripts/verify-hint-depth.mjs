import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]),dir=new URL('../docs/hint-depth-2026-10-07/',import.meta.url);mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const ready=()=>c.until(`(()=>{const s=document.querySelector('.garage-canvas')?.garageInspection?.snapshot();return s?.ready&&s.sceneKey===s.performance.renderedSceneKey&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'})()`);
async function reload(code){const t=await c.evaluate('performance.timeOrigin');await c.evaluate(code+';location.reload()');await c.until(`performance.timeOrigin!==${t}`);await ready();}
const errors=[];await c.send('Runtime.enable');c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.text));
try{
 await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.bringToFront');
 const cars=[{id:'target',color:'#e53935',row:2,col:0,len:2,dir:'H'},{id:'blocker',color:'#2563eb',row:0,col:3,len:3,dir:'V'},{id:'foreground',color:'#9333ea',row:4,col:0,len:3,dir:'H'},{id:'foreground-right',color:'#43a047',row:4,col:4,len:2,dir:'H'}];
 for(const [name,width,height,pitch,yaw]of [['front',1440,1000,30,0],['oblique',1440,1000,30,55],['reverse',1440,1000,30,145],['overhead',1440,1000,85,0],['mobile',390,844,35,30]]){
 await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
 await reload(`localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-depth',title:'地面遮擋檢查',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-depth',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:${pitch},yaw:${yaw},zoom:1,quality:'high',theme:'day'}))`);
 await c.click('提示');await c.until(`document.querySelector('.garage-canvas').garageInspection.snapshot().hintGuide?.distance===3`);await c.sleep(300);writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
 }
 assert.deepEqual(errors,[]);writeFileSync(new URL('results.json',dir),JSON.stringify({lowAngles:[0,55,145],overhead:true,mobileEmulation:true,hintDestinationUnchanged:true,errors},null,2));console.log('Hint depth desktop and mobile captures passed');
}finally{await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();}
