import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]);
const dir=new URL('../docs/editor-polish-2026-10-07/',import.meta.url);mkdirSync(dir,{recursive:true});
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const ready=()=>c.until(`(()=>{const s=document.querySelector('.garage-canvas')?.garageInspection?.snapshot();return s?.ready&&s.sceneKey===s.performance.renderedSceneKey&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'})()`);
const errors=[];await c.send('Runtime.enable');c.onEvent('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.text));
async function shot(name){await c.sleep(250);writeFileSync(new URL(name+'.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));}
async function mouse(p,type){await c.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1});}
async function button(text,touch=false){const p=await c.evaluate(`(()=>{const b=[...(document.querySelector('.win-card')||document).querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)});if(!b||b.disabled)throw Error('Unavailable '+${JSON.stringify(text)});const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(!b.contains(document.elementFromPoint(x,y)))throw Error('Obscured '+${JSON.stringify(text)});return{x,y}})()`);if(touch){await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await mouse(p,'mousePressed');await mouse(p,'mouseReleased');}await c.sleep(150);}
async function cell(row,col){const p=await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.project(${col+.5},.06,${row+.5})`);await mouse(p,'mousePressed');await mouse(p,'mouseReleased');await c.sleep(150);}
function luminance(color){const [r,g,b]=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b;}
try{
 await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.bringToFront');await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const time=await c.evaluate('performance.timeOrigin');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));location.reload()`);await c.until(`performance.timeOrigin!==${time}`);await ready();
 await button('編輯器');await ready();await button('驗證');assert(await c.evaluate(`document.querySelector('.instruction').classList.contains('validation-warning')`));await shot('validation-warning');
 await cell(2,0);await cell(2,1);await button('驗證');await c.until(`document.querySelector('.instruction.validation-success')?.textContent.includes('有解')`);await shot('validation-desktop');
 await button(await c.evaluate(`document.querySelector('.placed-car-list button').getAttribute('aria-label')`));await shot('validation-desktop');
 assert.deepEqual(await c.evaluate(`[...document.querySelector('.editor-completion').children].map(b=>b.textContent.trim())`),['驗證','試玩','儲存']);
 assert(await c.evaluate(`!document.querySelector('.editor-actions').contains(document.querySelector('.editor-exit'))`));
 for(const width of [390,320]){
 await c.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await c.sleep(350);
 assert(await c.evaluate(`document.documentElement.scrollWidth<=innerWidth`));
 await shot('validation-mobile-'+width);
 assert(await c.evaluate(`(()=>{const a=document.querySelector('.game-hud').getBoundingClientRect(),b=document.querySelector('.editor-exit').getBoundingClientRect();return a.right<=b.left||a.bottom<=b.top})()`),'Editor return and HUD do not overlap');
 for(let row=0;row<6;row++)for(let col=0;col<6;col++){const p=await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.project(${col+.5},.06,${row+.5})`);assert(await c.evaluate(`document.elementFromPoint(${p.x},${p.y})?.classList.contains('garage-canvas')`),`${width}px cell ${row},${col} unobscured`);}
 await shot('validation-mobile-'+width);
 }
 await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await button('儲存',true);await c.until(`document.querySelector('.editor-save')?.textContent==='更新關卡'`);await button('更新關卡',true);await c.until(`document.querySelector('.instruction')?.textContent.includes('已更新')`);
 await button('試玩',true);await ready();await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});
 const p=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection;const [x,,z]=a.snapshot().cars[0].position;for(const h of [.4,.6,.8]){const from=a.project(x,h,z);if(a.pick(from.x,from.y)==='target')return{from,to:a.project(x+4,h,z)};}throw Error('Unpickable racer')})()`);
 await mouse(p.from,'mousePressed');for(let i=1;i<=16;i++){await mouse({x:p.from.x+(p.to.x-p.from.x)*i/16,y:p.from.y+(p.to.y-p.from.y)*i/16},'mouseMoved');await c.sleep(25);}await mouse(p.to,'mouseReleased');await c.until(`!!document.querySelector('.win-card')`);
 assert.equal(await c.evaluate(`document.querySelector('.win-next').textContent.trim()`),'返回編輯器');assert(!await c.evaluate(`document.querySelector('.win-card').textContent.includes('選擇關卡')`));await shot('trial-win');await button('返回編輯器');await ready();assert.equal((await snap()).cars.length,1);assert.equal(await c.evaluate(`document.querySelector('.editor-save').textContent`),'更新關卡');
 await button('返回遊戲');await ready();await button('關卡');await button('我的關卡');await shot('custom-level-mobile');
 const styles=await c.evaluate(`(()=>{const item=document.querySelector('.custom-item'),b=item.querySelector('b'),s=item.querySelector('.custom-play span');return{background:getComputedStyle(item).backgroundColor,title:getComputedStyle(b).color,details:getComputedStyle(s).color}})()`);
 const bg=luminance(styles.background),contrast=color=>(luminance(color)+.05)/(bg+.05);assert(contrast(styles.title)>=4.5);assert(contrast(styles.details)>=4.5);
 assert.deepEqual(errors,[]);writeFileSync(new URL('results.json',dir),JSON.stringify({warningAndSuccessResults:true,verifyPlaySaveOrder:true,saveAndUpdate:true,separateExit:true,unobscuredCellsAndExit390And320:true,trialWinReturnsEditor:true,draftPreserved:true,customContrast:{title:contrast(styles.title),details:contrast(styles.details)},errors},null,2));console.log('Editor polish, trial victory and custom-level contrast passed');
}finally{
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
