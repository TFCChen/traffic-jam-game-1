import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { connect } from './cdp-test.mjs';
const c = await connect(process.argv[2]);
const dir = new URL('../docs/stages-2026-10-07/', import.meta.url); mkdirSync(dir, {recursive:true});
const saved = await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const snapshot = () => c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const ready = () => c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready && document.querySelector('.game-column').getAttribute('aria-busy')==='false'`);
async function shot(name) { await c.sleep(400); writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64')); }
const point = (row,col) => c.evaluate(`document.querySelector('.garage-canvas').garageInspection.project(${col+.5},.06,${row+.5})`);
async function pointer(p,type='mouseMoved') { await c.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:type==='mouseMoved'?'none':'left',buttons:type==='mousePressed'?1:0,clickCount:1}); }
async function cell(row,col) { const p=await point(row,col); await pointer(p,'mousePressed'); await pointer(p,'mouseReleased'); await c.sleep(180); }
async function tapButton(text,touch=false) {
  const p=await c.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)throw Error('Unavailable '+${JSON.stringify(text)});b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(!b.contains(document.elementFromPoint(x,y)))throw Error('Button obscured '+${JSON.stringify(text)});return {x,y};})()`);
  if(touch){await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else {await pointer(p,'mousePressed');await pointer(p,'mouseReleased');}await c.sleep(200);
}
async function dragCar(id,delta) {
  const p=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection,c=a.snapshot().cars.find(c=>c.id===${JSON.stringify(id)}),[x,,z]=c.position;for(const h of [.6,.8,.35,1])for(const o of [0,-.2,.2]){const px=x+(c.dir==='H'?o:0),pz=z+(c.dir==='V'?o:0),from=a.project(px,h,pz);if(a.pick(from.x,from.y)!==c.id)continue;return {from,to:a.project(px+(c.dir==='H'?${delta}:0),h,pz+(c.dir==='V'?${delta}:0))};}return null;})()`);
  assert(p,`${id} selectable`); await pointer(p.from,'mousePressed');
  for(let i=1;i<=6;i++){await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.from.x+(p.to.x-p.from.x)*i/6,y:p.from.y+(p.to.y-p.from.y)*i/6,button:'left',buttons:1});await c.sleep(35);}
  await pointer(p.to,'mouseReleased');await c.sleep(200);
}
try {
  await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:75,yaw:0,zoom:1,quality:'high',theme:'day',motion:1.2}));location.reload()`);
  await ready(); await c.click('編輯器'); await c.click('清空'); await c.sleep(600);
  assert.equal((await snapshot()).editorPlacement.legalStarts,5);
  await pointer(await point(0,0)); await c.sleep(200);assert.equal((await snapshot()).editorPlacement.preview.valid,false);
  await pointer(await point(2,0)); await c.sleep(200);assert.equal((await snapshot()).editorPlacement.preview.valid,true);
  await shot('editor-red-preview');await cell(2,0);await cell(2,1);
  assert.equal((await snapshot()).cars.length,1);
  await c.evaluate(`[...document.querySelectorAll('.editor-vehicle-cards button')].find(b=>b.textContent.includes('城市巴士')).click()`);
  await pointer(await point(0,0));await c.sleep(250);
  assert.equal((await snapshot()).editorPlacement.preview.len,3);
  await cell(0,0);await cell(0,2); assert.equal((await snapshot()).cars.length,2);
  assert.equal((await snapshot()).cars.find(car=>car.id!=='target').model,'coach');
  await c.click('復原編輯');assert.equal((await snapshot()).cars.length,1);
  await c.click('重做編輯');assert.equal((await snapshot()).cars.length,2);
  await c.evaluate(`document.querySelector('.garage-canvas').focus()`);
  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'z',code:'KeyZ',modifiers:2,windowsVirtualKeyCode:90});
  await c.sleep(150);assert.equal((await snapshot()).cars.length,1,'Ctrl Z restores previous draft');
  await c.click('重做編輯');
  await c.click('驗證');await c.until(`document.querySelector('.editor-validation')?.textContent.includes('關卡有解')`);
  await shot('editor-desktop');
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await c.sleep(700);await shot('editor-mobile');
  assert(await c.evaluate(`document.documentElement.scrollWidth<=innerWidth`),'No horizontal mobile overflow');
  assert(await c.evaluate(`(()=>{const r=document.querySelector('.editor-orientation').getBoundingClientRect();return r.right<=innerWidth&&r.left>=0})()`),'Direction controls fit mobile dock');
  await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const start=await point(3,2),end=await point(3,3);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,id:1}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:end.x,y:end.y,id:1}]});await c.sleep(200);
  assert.equal((await snapshot()).editorPlacement.preview.col,3,'Touch placement previews release position');
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.sleep(250);
  assert.equal((await snapshot()).cars.length,3,'Touch drag places new car');
  await c.click('復原編輯');assert.equal((await snapshot()).cars.length,2);
  await tapButton('驗證',true);await c.until(`document.querySelector('.editor-validation')?.textContent.includes('關卡有解')`);
  await c.evaluate(`document.querySelector('.editor-actions').scrollTop=document.querySelector('.editor-actions').scrollHeight`);await shot('editor-mobile-actions');
  await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await c.sleep(500);
  await tapButton('試玩');await ready();await dragCar('target',4);await c.until(`!!document.querySelector('.win-card')`);await shot('win-trial');
  assert.equal(await c.evaluate(`document.querySelector('.win-next').textContent.trim()`),'選擇關卡','Draft has no automatic next official level');
  await tapButton('再玩一次');await ready();assert.equal((await snapshot()).cars.find(car=>car.id==='target').position[0],1,'Replay returns red car to start');
  await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');location.reload()`);await ready();
  const solution=JSON.parse(readFileSync(new URL('../public/levels/solutions.json',import.meta.url)))[1].solution;
  for(const move of solution.moves)await dragCar(move.carId,move.delta);
  await c.until(`!!document.querySelector('.win-card')`);
  assert.equal(await c.evaluate(`Number(document.querySelector('.win-score b').textContent)`),solution.moves.length);
  assert.equal(await c.evaluate(`document.querySelector('#win-title').textContent`),'完美出庫');await shot('win-official');
  assert.equal(await c.evaluate(`document.querySelector('.win-up-next').textContent`),'下一站 · 第 02 關');
  await tapButton('下一關');await c.until(`document.querySelector('.stage-heading h2')?.textContent==='第 02 關' && !document.querySelector('.level-transition')`);await ready();
  assert.equal(await c.evaluate(`Number(document.querySelector('.stats b').textContent)`),0);await shot('next-level');
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const reducedCars=[{id:'target',color:'#e53935',row:2,col:0,len:2,dir:'H'}];
  await c.evaluate(`localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-reduced',title:'低動態檢查',cars:${JSON.stringify(reducedCars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-reduced',cars:${JSON.stringify(reducedCars)},history:[],moves:0}}));location.reload()`);
  await ready();await dragCar('target',4);await c.until(`!!document.querySelector('.win-card')`);
  assert.equal((await snapshot()).cameraFollow,0,'Reduced motion omits cinematic camera move');
  writeFileSync(new URL('results.json',dir),JSON.stringify({legalRedStarts:5,invalidPreview:true,modelSelection:true,undoRedo:true,undoShortcut:true,validation:true,mobileOverflow:false,actualTouchPlacement:true,actualTouchValidationButton:true,unobscuredTrialAndNextButtons:true,trialWin:true,optimalOfficialWin:true,nextLevel:true},null,2));
  console.log('Editor previews/model selection/undo/redo/validation/mobile layout, trial and official mouse-play victory, next-level transition passed.');
} finally {
  await c.send('Emulation.setEmulatedMedia',{features:[]});
  await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await c.send('Emulation.clearDeviceMetricsOverride');
  await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
