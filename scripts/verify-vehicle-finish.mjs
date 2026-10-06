import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { connect } from './cdp-test.mjs';
const c = await connect(process.argv[2]);
const dir = new URL('../docs/vehicle-finish-2026-10-06/', import.meta.url);
mkdirSync(dir, { recursive: true });
const saved = await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const errors = [], results = [];
await c.send('Runtime.enable');
c.onEvent('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails.text));
c.onEvent('Runtime.consoleAPICalled', e => { if(e.type==='error') errors.push(e.args.map(a=>a.value??a.description??'').join(' ')); });
const snapshot = () => c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
  const cars = [{id:'target',color:'#e54848',row:2,col:1,len:2,dir:'H'}];
  for (const theme of ['day','sunset','neon']) {
    const origin = await c.evaluate('performance.timeOrigin');
    await c.evaluate(`localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(Object.fromEntries(Array.from({length:40},(_,i)=>[i+1,{completed:true,stars:1,bestMoves:99}]))));localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([{id:'custom-finish',title:'車漆與金屬檢查',cars:${JSON.stringify(cars)}}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-finish',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:40,yaw:135,zoom:3,focusX:-1,focusZ:-.5,quality:'high',theme:'${theme}',shadows:true,intensity:3,motion:1.2}));location.reload()`);
    await c.until(`performance.timeOrigin!==${origin}&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready===true`);
    await c.until(`document.querySelector('.garage-canvas').garageInspection.snapshot().settings.theme==='${theme}'`);
    assert.equal((await snapshot()).settings.theme, theme);
    for (const [quality, coat] of [['saver',0],['standard',.55],['high',.92]]) {
      await c.click('車庫設定');
      await c.evaluate(`document.querySelectorAll('.quality-options button')[${['high','standard','saver'].indexOf(quality)}].click()`);
      await c.until(`document.querySelector('.garage-canvas').garageInspection.snapshot().settings.quality==='${quality}'`);
      await c.click('關閉車庫設定');
      await c.sleep(250);
      const s = await snapshot();
      assert(s.cars[0].finish.every(m=>m.physical&&m.clearcoat===coat));
      assert(s.cars[0].glazing.every(m=>m.roughness===.003&&m.optics==='thin-sheet'));
      results.push({theme,quality,finish:s.cars[0].finish});
    }
    writeFileSync(new URL(`${theme}.png`,dir),Buffer.from((await c.send('Page.captureScreenshot')).data,'base64'));
  }
  assert.deepEqual(errors,[]);
  writeFileSync(new URL('verification.json',dir),JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({results,errors}));
} finally {
  await c.send('Emulation.clearDeviceMetricsOverride');
  await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);
  c.close();
}

