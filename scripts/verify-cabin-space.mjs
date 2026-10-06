import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
import {legalMovesForCar,validateLevel} from '../src/gameEngine.js';
const {send,evaluate,sleep,until,click,close}=await connect(process.argv[2]);
const saved=await evaluate("Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))");
const colours={racer:'#e54848',jeep:'#62b447',compact:'#52a6da',taxi:'#965ad0',pickup:'#e9a83f',delivery:'#bc54d5',schoolbus:'#f2d451',coach:'#4875dc',camper:'#60b49a'};
const slots=[['jeep',0,0,2],['compact',0,2,2],['taxi',0,4,2],['pickup',1,0,2],['delivery',1,2,3],['racer',2,0,2],['schoolbus',3,0,3],['coach',4,0,3],['camper',5,0,3]];
const cars=slots.map(([kind,row,col,len])=>({id:kind==='racer'?'target':kind,color:colours[kind],row,col,len,dir:'H'}));
assert.ok(validateLevel(cars).valid);
const level={id:'custom-glass-review',title:'玻璃與內裝檢查',cars};
const dir=new URL('../docs/cabin-space-2026-10-06/',import.meta.url);mkdirSync(dir,{recursive:true});
const results=[];
const snapshot=()=>evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot()");
async function load(spec){
 const origin=await evaluate('performance.timeOrigin');
 await evaluate(`localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([${JSON.stringify(level)}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-glass-review',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(Object.fromEntries(Array.from({length:40},(_,i)=>[i+1,{completed:true,stars:1,bestMoves:99}]))));localStorage.setItem('traffic-jam-scene',JSON.stringify(${JSON.stringify({pitch:55,yaw:-12,zoom:1,focusX:0,focusZ:0,panX:0,panY:0,light:-40,intensity:3,shadows:true,theme:'day',quality:'standard',motion:1.2,...spec})}));location.reload()`);
 await until(`performance.timeOrigin!==${origin}`);
 await until("(()=>{const c=document.querySelector('.garage-canvas'),s=c?.garageInspection?.snapshot();return s?.ready&&s.sceneKey==='custom-glass-review-play'&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'})()");await sleep(500);
}
async function shot(name){writeFileSync(new URL(name+'.png',dir),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
function checkGlass(s,quality){
 assert.equal(s.cars.length,9);
 for(const c of s.cars){assert.ok(c.glazing.length&&c.glazing.every(g=>g.physical&&g.ior===1.48));assert.ok(c.glazing.every(g=>g.transmission===0&&g.optics==='thin-sheet'));}
}
async function dragPoint(){
 const moves=cars.filter(c=>c.id!=='target').flatMap(c=>legalMovesForCar(cars,c.id));
 return evaluate(`(()=>{const c=document.querySelector('.garage-canvas'),a=c.garageInspection,r=c.getBoundingClientRect(),inside=p=>p.x>r.left+20&&p.x<r.right-20&&p.y>r.top+130&&p.y<r.bottom-190;for(const m of ${JSON.stringify(moves)}){const v=a.snapshot().cars.find(c=>c.id===m.carId),[x,,z]=v.position;for(const h of [.6,.8,.5,1]){const from=a.project(x,h,z),to=a.project(x+m.delta,h,z);if(inside(from)&&inside(to)&&a.pick(from.x,from.y)===v.id)return {from,to,id:v.id,delta:m.delta};}}return null})()`);
}
async function press(p){await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.from.x,y:p.from.y,button:'left',buttons:1,clickCount:1});}
async function move(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'left',buttons:1});}
try{
 await send('Network.enable');await send('Network.setBypassServiceWorker',{bypass:true});await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 // A new installation starts in high quality, without overwriting an explicit preference.
 await evaluate("localStorage.removeItem('traffic-jam-scene');location.reload()");
 await until("document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready===true");
 assert.equal((await snapshot()).settings.quality,'high');
 results.push('Fresh settings default to high quality.');
 for(const spec of [
  {name:'all-nine-standard',quality:'standard'},
  {name:'coupe-side-high',quality:'high',pitch:35,yaw:180,zoom:3,focusX:-2,focusZ:-.5},
  {name:'coupe-front-high',quality:'high',pitch:35,yaw:90,zoom:3,focusX:-2,focusZ:-.5},
  {name:'coupe-rear-high',quality:'high',pitch:40,yaw:-90,zoom:3,focusX:-2,focusZ:-.5},
  {name:'all-nine-sunset',quality:'high',pitch:50,yaw:20,theme:'sunset'},
  {name:'all-nine-neon',quality:'high',pitch:50,yaw:-20,theme:'neon'},
  {name:'all-nine-saver',quality:'saver'},
 ]){
  await load(spec);checkGlass(await snapshot(),spec.quality);await shot(spec.name);results.push(spec.name+': all 9 vehicle windows use the expected glass mode; screenshot captured.');
 }
 for(const yaw of [-180,-90,0,90]){
  await load({quality:'high',pitch:30,yaw,zoom:.65,focusX:25,focusZ:-25,panX:5,panY:5});
  const depth=await evaluate("(()=>{const a=document.querySelector('.garage-canvas').garageInspection;return [-100,100].flatMap(x=>[-100,100].map(z=>a.project(x,-.48,z).depth))})()");
  assert.ok(depth.every(z=>z>-1&&z<1),'Entire ground must remain inside camera depth range');
  await shot('low-angle-'+yaw);
 }
 results.push('30-degree orbit at 65% zoom and large focus offsets: ground remains inside depth planes at all four cardinal angles.');
 await load({quality:'high',pitch:30,zoom:4});
 const originalFrustum=(await snapshot()).cameraFrustum;
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:700,y:450,button:'right',buttons:2,clickCount:1});
 for(let i=1;i<=18;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:700+i*15,y:450+i*2,button:'right',buttons:2});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:970,y:486,button:'right',clickCount:1});await sleep(300);
 assert.equal((await snapshot()).settings.zoom,4);
 assert.ok(Math.abs((await snapshot()).cameraFrustum.width-originalFrustum.width)<.001);
 results.push('Real right-button orbit at 400% preserves zoom and viewport scale.');
 // Unobstructed first-level close-ups show the cabin through production glazing.
 for(const [name,yaw,pitch] of [['coupe-front-playing',90,40],['coupe-side-playing',180,32]]){
  const origin=await evaluate('performance.timeOrigin');
  await evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-scene',JSON.stringify({quality:'high',pitch:${pitch},yaw:${yaw},zoom:3,focusX:-1,focusZ:-.5,panX:0,panY:0,theme:'day'}));location.reload()`);
  await until(`performance.timeOrigin!==${origin}`);
  await until("document.querySelector('.garage-canvas')?.garageInspection?.snapshot().sceneKey==='1-play'");await sleep(600);await shot(name);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await load({quality:'standard'});checkGlass(await snapshot(),'standard');await shot('mobile-standard');assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
 results.push('390px mobile: full viewport and no horizontal overflow.');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 const performanceResults=[];
 for(const quality of ['standard','high','saver']){
  await load({quality});const p=await dragPoint();assert.ok(p,'A visible car must be selectable.');
  await evaluate("document.querySelector('.garage-canvas').garageInspection.measure(true)");
  await press(p);const start=await snapshot(),t=Date.now();
  for(let i=0;i<120;i++){await move(p.from.x+(p.to.x-p.from.x)*.16*Math.sin(i*.10),p.from.y+(p.to.y-p.from.y)*.16*Math.sin(i*.10));await sleep(16);}
  const end=await snapshot();performanceResults.push({quality,activeFPS:(end.performance.frames-start.performance.frames)/((Date.now()-t)/1000),...end.performance.profile,inputToSubmission:end.performance.inputToSubmission});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.from.x,y:p.from.y,button:'left',clickCount:1});await sleep(100);
  assert.equal(await evaluate("Boolean(document.querySelector('.garage-canvas').dataset.dragging)"),false);assert.equal(await evaluate("document.querySelector('.stats b').textContent"),'0');
  await evaluate("document.querySelector('.garage-canvas').garageInspection.measure(false)");
 }
 await load({quality:'standard'});const p=await dragPoint();await press(p);
 for(let i=1;i<=10;i++){await move(p.from.x+(p.to.x-p.from.x)*i/10,p.from.y+(p.to.y-p.from.y)*i/10);await sleep(20);}
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.to.x,y:p.to.y,button:'left',clickCount:1});await sleep(400);
 assert.equal(await evaluate("document.querySelector('.stats b').textContent"),'1');await click('復原');assert.equal(await evaluate("document.querySelector('.stats b').textContent"),'0');
 results.push('Real pointer drag commits one legal move; undo restores the board.');
 await click('車庫設定');
 for(const quality of ['saver','high','standard']){
  await evaluate(`(()=>{const names={saver:'省電',high:'精緻',standard:'標準'},b=[...document.querySelectorAll('.quality-options button')].find(b=>b.textContent.trim().startsWith(names['${quality}']));if(!b)throw Error('Missing quality option');b.click()})()`);await sleep(500);checkGlass(await snapshot(),quality);
 }
 results.push('Switching saver/high/standard in the live UI updates window shaders correctly.');
 await click('關閉車庫設定');
 writeFileSync(new URL('verification.json',dir),JSON.stringify({results,performanceResults},null,2));console.log(JSON.stringify({results,performanceResults}));
}finally{
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:20,y:20,button:'left',clickCount:1}).catch(()=>{});
 await send('Emulation.clearDeviceMetricsOverride');
 await evaluate(`(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()})()`);
 await send('Network.setBypassServiceWorker',{bypass:false});await send('Network.setCacheDisabled',{cacheDisabled:false});close();
}




