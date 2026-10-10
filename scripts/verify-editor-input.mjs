import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]);
const dir=new URL('../docs/editor-input-2026-10-06/',import.meta.url);mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const selected=()=>c.evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='取消選點')`);
async function cell(row,col){
  const p=await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.project(${col+.5},.055,${row+.5})`);
  assert(await c.evaluate(`document.elementFromPoint(${p.x},${p.y})===document.querySelector('.garage-canvas')`),'Test cell is unobstructed');
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
  await c.sleep(300);
}
try{
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.removeItem('traffic-jam-draft-v1');localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:90,yaw:0,zoom:1,quality:'standard',theme:'day',motion:1.2}));location.reload()`);
  await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready`);
  await c.click('編輯器');await c.click('清空');
  await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length===0`);
  await c.sleep(700);
  await cell(0,0);assert.equal(await selected(),false,'Red car cannot start outside exit row');
  await cell(2,0);assert(await selected());
  await cell(2,0);assert.equal(await selected(),false,'Repeat click cancels');
  await cell(2,0);await cell(3,1);assert.equal(await selected(),false,'Invalid diagonal clears origin');
  await cell(2,0);await cell(2,2);assert.equal(await selected(),false,'Invalid red length clears origin');
  await cell(2,0);await cell(2,1);
  await c.until(`document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length===1`);
  assert((await snap()).cars[0].id==='target');
  await cell(0,0);await cell(2,0);assert.equal(await selected(),false,'Occupied endpoint clears selection');
  assert.equal((await snap()).cars.length,1);
  await cell(0,0);await cell(0,1);assert.equal((await snap()).cars.length,2);
  await c.evaluate(`document.querySelector('.utility-menu summary').click()`);
  assert(await c.evaluate(`document.querySelector('.utility-menu').open`));
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:15,y:15,button:'left',buttons:1,clickCount:1});
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:15,y:15,button:'left',clickCount:1});
  assert.equal(await c.evaluate(`document.querySelector('.utility-menu').open`),false,'Outside pointer closes menu');
  await c.evaluate(`document.querySelector('.utility-menu summary').click()`);
  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert.equal(await c.evaluate(`document.querySelector('.utility-menu').open`),false,'Escape closes menu');
  writeFileSync(new URL('editor.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
  console.log('Actual cell clicks: red lane restriction, toggle, invalid diagonal/length/occupied reset, subsequent placement, outside/Escape menu close passed.');
}finally{
  await c.send('Emulation.clearDeviceMetricsOverride');
  await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);
  c.close();
}
