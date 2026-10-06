import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]);
const dir=new URL('../docs/editor-repair-2026-10-07/',import.meta.url);mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const errors=[];await c.send('Runtime.enable');c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.text));
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const ready=()=>c.until(`(()=>{const s=document.querySelector('.garage-canvas')?.garageInspection?.snapshot();return s?.ready&&s.sceneKey===s.performance.renderedSceneKey&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'})()`);
const shot=async name=>{await c.sleep(350);writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));};
const point=(row,col)=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.project(${col+.5},.06,${row+.5})`);
async function mouse(p,type='mouseMoved'){await c.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1});}
async function cell(row,col){const p=await point(row,col);assert(await c.evaluate(`document.elementFromPoint(${p.x},${p.y})?.classList.contains('garage-canvas')`),'Editor cell must not be obscured by UI');await mouse(p,'mousePressed');await mouse(p,'mouseReleased');await c.sleep(160);}
async function button(text,touch=false){const p=await c.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)});if(!b||b.disabled)throw Error('Unavailable '+${JSON.stringify(text)});b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(!b.contains(document.elementFromPoint(x,y)))throw Error('Obscured button '+${JSON.stringify(text)});return{x,y}})()`);if(touch){await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await mouse(p,'mousePressed');await mouse(p,'mouseReleased');}await c.sleep(220);}
async function reload(code){const t=await c.evaluate('performance.timeOrigin');await c.evaluate(code+';location.reload()');await c.until(`performance.timeOrigin!==${t}`);await ready();}
try{
 await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.bringToFront');
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await reload(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:65,yaw:15,zoom:1,quality:'high',theme:'day'}))`);
 const original=(await snap()).cars;
 await button('編輯器');await ready();await c.sleep(400);
 assert.equal((await snap()).cars.length,0,'Fresh editor starts empty');assert.equal((await snap()).settings.pitch,85);assert.equal((await snap()).editorPlacement.legalStarts,6);
 assert.equal(await c.evaluate(`document.querySelectorAll('.editor-tray,.editor-vehicle-cards,.editor-orientation').length`),0);
 assert(await c.evaluate(`![...document.querySelectorAll('.toolbar button')].some(b=>['關卡','編輯器'].includes(b.textContent.trim()))`));
 await cell(0,0);assert.equal((await snap()).cars.length,0);await cell(2,1);await cell(2,0);assert.equal((await snap()).cars.length,1);
 await cell(0,3);await cell(0,1);await cell(5,4);await cell(4,4);await cell(0,5);await cell(2,5);
 assert.deepEqual((await snap()).cars.map(v=>[v.dir,v.len]),[['H',2],['H',3],['V',2],['V',3]]);
 await cell(3,0);await cell(4,1);assert.equal((await snap()).cars.length,4);assert.equal(await c.evaluate(`!!document.querySelector('.editor-start-marker')`),false);
 await cell(3,0);await cell(3,0);assert.equal((await snap()).cars.length,4);
 const coach=(await snap()).cars.find(v=>v.model==='coach');
 await c.evaluate(`[...document.querySelectorAll('.placed-car-list button')].find(b=>b.textContent.includes('巴士')).click()`);await button('更換車種');await shot('editor-model-menu');await button('露營車');await ready();
 const camper=(await snap()).cars.find(v=>v.id===coach.id);assert.equal(camper.model,'camper');assert.deepEqual(camper.position,coach.position);assert.equal(camper.len,coach.len);assert.equal(camper.dir,coach.dir);
 await button('復原編輯');await ready();assert.equal((await snap()).cars.find(v=>v.id===coach.id).model,'coach');await button('重做編輯');await ready();
 await c.evaluate(`document.querySelector('.placed-car-list button').click()`);assert.equal(await c.evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='更換車種')`),false);
 await shot('editor-desktop');
 for(let row=0;row<6;row++)for(let col=0;col<6;col++){const p=await point(row,col);assert(await c.evaluate(`document.elementFromPoint(${p.x},${p.y})?.classList.contains('garage-canvas')`),`Desktop cell ${row},${col} is unobscured`);}
 await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await c.sleep(600);await shot('editor-mobile');
 assert(await c.evaluate(`document.documentElement.scrollWidth<=innerWidth`));
 for(let row=0;row<6;row++)for(let col=0;col<6;col++){const p=await point(row,col);assert(await c.evaluate(`document.elementFromPoint(${p.x},${p.y})?.classList.contains('garage-canvas')`),`Mobile cell ${row},${col} is unobscured`);}
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 const from=await point(3,0),to=await point(3,2);assert(await c.evaluate(`document.elementFromPoint(${from.x},${from.y})?.classList.contains('garage-canvas')`));
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...to,id:1}]});await c.sleep(180);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.sleep(350);assert.equal((await snap()).cars.length,5,'Touch drag automatically places H3');
 await button('復原編輯',true);assert.equal((await snap()).cars.length,4);
 await button('清空',true);await cell(2,0);await cell(2,1);await button('驗證',true);await c.until(`document.querySelector('.instruction')?.textContent.includes('有解')`);await shot('editor-mobile-valid');
 await button('儲存',true);await c.until(`JSON.parse(localStorage.getItem('traffic-jam-custom-levels-v2')||'[]').length===1`);
 await button('試玩',true);await ready();await button('返回草稿',true);await ready();assert.equal((await snap()).cars.length,1,'Trial retains draft');await button('返回遊戲',true);await ready();
 assert.deepEqual((await snap()).cars.map(v=>v.id),original.map(v=>v.id),'Return restores original level');assert.equal((await snap()).settings.pitch,65);assert.equal((await snap()).settings.yaw,15);
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 const cars=[{id:'target',color:'#e54848',row:2,col:1,len:2,dir:'H'}];
 for(const [name,pitch,yaw,theme] of [['racer-front',35,55,'day'],['racer-top',60,145,'day'],['racer-night',35,55,'night']]){
 await reload(`localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-detail',title:'燈組檢查',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-detail',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:${pitch},yaw:${yaw},zoom:3,focusX:-1,focusZ:-.5,quality:'high',theme:'${theme}',shadows:true,intensity:3}))`);
 const s=await snap();assert(s.cars[0].lampOrigins.head.every(Boolean));await shot(name);
 if(name==='racer-front'){
 const p=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection;for(const h of [.4,.6,.8]){const from=a.project(2,h,2.5);if(a.pick(from.x,from.y)==='target')return{from,to:a.project(3,h,2.5)};}throw Error('Red car not selectable')})()`);
 await mouse(p.from,'mousePressed');for(let i=1;i<=12;i++){await mouse({x:p.from.x+(p.to.x-p.from.x)*i/12,y:p.from.y+(p.to.y-p.from.y)*i/12});await c.sleep(25);}await mouse(p.to,'mouseReleased');await c.until(`document.querySelector('.stats b').textContent==='1'`);const moved=await snap();assert(Math.abs(moved.cars[0].wheelAngle)>.1);assert(Math.abs(moved.cars[0].lampOrigins.head[0][0]-s.cars[0].lampOrigins.head[0][0]-1)<.05);await button('復原');await c.until(`document.querySelector('.stats b').textContent==='0'`);
 }
 }
 assert.deepEqual(errors,[]);writeFileSync(new URL('results.json',dir),JSON.stringify({freshBlank:true,freeReverseDrawing:true,automaticLengthsAndDirections:true,sameLengthReplacementPreservesPlacement:true,redCannotSwap:true,undoRedo:true,nativeTouchPlacement:true,mobileUnobscuredActions:true,all36CellsUnobscuredDesktopAndMobile:true,save:true,trialDraftReturn:true,originalGameAndViewRestored:true,lampOrigins:true,nativeCarDragAndLampTracking:true,errors},null,2));console.log('Editor repair native mouse/touch and lamp fixtures passed');
}finally{
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v] of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
