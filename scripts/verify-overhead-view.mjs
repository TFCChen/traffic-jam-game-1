import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
import {legalMovesForCar} from '../src/gameEngine.js';
const c=await connect(process.argv[2]);
const dir=new URL('../docs/overhead-view-2026-10-06/',import.meta.url);mkdirSync(dir,{recursive:true});
const snap=()=>c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const results=[];
try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 await c.evaluate(`localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:70,yaw:-12,quality:'standard'}));location.reload()`);
 await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready===true`);await c.sleep(500);
 let s=await snap();assert.equal(s.settings.pitch,90);assert.equal(s.settings.yaw,0);assert.equal(s.settings.quality,'standard');
 const axes=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection;return [a.project(0,.055,0),a.project(1,.055,0),a.project(0,.055,1)]})()`);
 assert(Math.abs(axes[0].y-axes[1].y)<1e-6);assert(Math.abs(axes[0].x-axes[2].x)<1e-6);
 assert(axes[1].x>axes[0].x&&axes[2].y>axes[0].y);
 results.push('Legacy play preset migrates to 90/0 while preserving quality; board axes align with screen axes.');
 await c.click('車庫設定');await c.click('展示視角');await c.sleep(200);assert.equal((await snap()).settings.pitch,45);
 await c.click('遊玩視角');await c.sleep(200);s=await snap();assert.equal(s.settings.pitch,90);assert.equal(s.settings.yaw,0);
 assert.equal(await c.evaluate(`document.querySelector('input[aria-label="俯視角"]').max`),'90');await c.click('關閉車庫設定');
 await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:700,y:400,button:'right',buttons:2,clickCount:1});
 for(let i=1;i<=12;i++){await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:700+i*5,y:400-i*3,button:'right',buttons:2});await c.sleep(20);}
 await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:760,y:364,button:'right',clickCount:1});await c.sleep(300);
 s=await snap();assert(s.settings.pitch<90);assert(s.settings.yaw<0);assert.equal(s.settings.zoom,1);
 await c.click('重置');await c.sleep(300);s=await snap();assert.equal(s.settings.pitch,90);assert.equal(s.settings.yaw,0);
 results.push('Play preset, slider, exact-vertical orbit and reset work through the real UI without auto zoom.');
 const cars=JSON.parse(readFileSync('public/levels/level-001.json')).cars;
 const moves=cars.flatMap(car=>legalMovesForCar(cars,car.id));
 const point=await c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection,cs=a.snapshot().cars;for(const m of ${JSON.stringify(moves)}){const car=cs.find(c=>c.id===m.carId);if(!car)continue;const [x,,z]=car.position;for(const h of [.5,.7,.9]){const p=a.project(x,h,z);if(a.pick(p.x,p.y)===car.id)return{from:p,to:a.project(x+(car.dir==='H'?m.delta:0),h,z+(car.dir==='V'?m.delta:0))};}}return null})()`);
 assert(point,'A car must remain selectable from the vertical view');
 await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.from.x,y:point.from.y,button:'left',buttons:1,clickCount:1});
 for(let i=1;i<=10;i++){await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.from.x+(point.to.x-point.from.x)*i/10,y:point.from.y+(point.to.y-point.from.y)*i/10,button:'left',buttons:1});await c.sleep(20);}
 await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.to.x,y:point.to.y,button:'left',clickCount:1});await c.sleep(300);
 assert.equal(await c.evaluate(`document.querySelector('.stats b').textContent`),'1');await c.click('復原');assert.equal(await c.evaluate(`document.querySelector('.stats b').textContent`),'0');
 results.push('Actual pointer car selection and legal drag at 90 degrees record a move and undo correctly.');
 writeFileSync(new URL('desktop.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
 await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await c.sleep(500);
 assert.equal(await c.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
 writeFileSync(new URL('mobile.png',dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
 writeFileSync(new URL('verification.json',dir),JSON.stringify({results,axes},null,2));console.log(JSON.stringify(results));
}finally{
 await c.send('Emulation.clearDeviceMetricsOverride');
 await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
