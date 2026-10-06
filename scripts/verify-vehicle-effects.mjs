import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { connect } from './cdp-test.mjs';
const c = await connect(process.argv[2]);
const dir = new URL('../docs/vehicle-effects-2026-10-06/', import.meta.url);
mkdirSync(dir, {
  recursive: true
});
const saved = await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
const errors = [];
await c.send('Runtime.enable');
c.onEvent('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails.text));
await c.send('Log.enable');
c.onEvent('Log.entryAdded', e => {
  if (e.entry.level === 'error') errors.push(e.entry.text);
});
const snap = () => c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const progress = Object.fromEntries(Array.from({
  length: 40
}, (_, i) => [i + 1, {
  completed: true,
  stars: 1,
  bestMoves: 99
}]));
const results = [],
  perf = [];
async function load(theme, quality = 'high', pitch = 50, fleet = false) {
  let cars = [{
    id: 'target',
    color: '#e54848',
    row: 2,
    col: 0,
    len: 2,
    dir: 'H'
  }, {
    id: 'blocker',
    color: '#62b447',
    row: 1,
    col: 5,
    len: 2,
    dir: 'V'
  }];
  if (fleet) cars = [['jeep', '#62b447', 0, 0, 2], ['compact', '#52a6da', 0, 2, 2], ['taxi', '#965ad0', 0, 4, 2], ['pickup', '#e9a83f', 1, 0, 2], ['delivery', '#bc54d5', 1, 2, 3], ['target', '#e54848', 2, 0, 2], ['schoolbus', '#f2d451', 3, 0, 3], ['coach', '#4875dc', 4, 0, 3], ['camper', '#60b49a', 5, 0, 3]].map(([id, color, row, col, len]) => ({
    id,
    color,
    row,
    col,
    len,
    dir: 'H'
  }));
  const level = {
      id: 'custom-effects-review',
      title: '燈光與排氣檢查',
      cars
    },
    origin = await c.evaluate('performance.timeOrigin');
  await c.evaluate(`localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(${JSON.stringify(progress)}));localStorage.setItem('traffic-jam-custom-levels-v2',JSON.stringify([${JSON.stringify(level)}]));localStorage.setItem('traffic-jam-session-v1',JSON.stringify({schema:1,data:{levelId:'custom-effects-review',cars:${JSON.stringify(cars)},history:[],moves:0}}));localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:${pitch},yaw:-25,zoom:1.35,focusX:0,focusZ:0,panX:0,panY:0,light:-40,intensity:3,shadows:true,theme:'${theme}',quality:'${quality}',motion:1.2}));location.reload()`);
  await c.until(`performance.timeOrigin!==${origin}`);
  await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready===true`);
  await c.until(`document.querySelector('.garage-canvas').garageInspection.snapshot().calls>20`);
  await c.sleep(700);
  const s = await snap();
  assert.equal(s.settings.theme, theme);
  assert.equal(s.sceneKey, 'custom-effects-review-play');
  return s;
}
async function shot(name) {
  writeFileSync(new URL(name + '.png', dir), Buffer.from((await c.send('Page.captureScreenshot')).data, 'base64'));
}
async function points(id, delta) {
  return c.evaluate(`(()=>{const a=document.querySelector('.garage-canvas').garageInspection,car=a.snapshot().cars.find(c=>c.id==='${id}'),[x,,z]=car.position;for(const h of [.35,.45,.55,.7,.9]){const p=a.project(x,h,z);if(a.pick(p.x,p.y)==='${id}')return {from:p,to:a.project(x+(car.dir==='H'?${delta}:0),h,z+(car.dir==='V'?${delta}:0))};}return null})()`);
}
async function drag(id, delta, name) {
  const p = await points(id, delta);
  assert(p, 'Car must remain pickable');
  await c.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: p.from.x,
    y: p.from.y,
    button: 'left',
    buttons: 1,
    clickCount: 1
  });
  let peak = 0;
  for (let i = 1; i <= 24; i++) {
    await c.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: p.from.x + (p.to.x - p.from.x) * i / 24,
      y: p.from.y + (p.to.y - p.from.y) * i / 24,
      button: 'left',
      buttons: 1
    });
    await c.sleep(25);
    const s = await snap();
    assert.equal(s.vehicleLighting.owner, id);
    assert.equal(s.transmissionResolutionScale, 1);
    peak = Math.max(peak, s.exhaustSmoke.active);
  }
  const during = await snap();
  assert(peak > 0);
  assert(during.exhaustSmoke.capacity === 56 && during.exhaustSmoke.drawCalls === 1);
  assert.equal(during.vehicleLighting.rear.color, 'ef3024');
  if (name) await shot(name);
  await c.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: p.to.x,
    y: p.to.y,
    button: 'left',
    clickCount: 1
  });
  await c.sleep(90);
  const brake = await snap();
  await c.sleep(300);
  return {
    during,
    brake,
    peak
  };
}
try {
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false
  });
  for (const theme of ['day', 'sunset', 'neon']) {
    const idle = await load(theme);
    assert(idle.vehicleLighting.headlights.every(l => l.shadow && l.distance === 5.5 && l.decay === 2));
    await shot(theme + '-idle');
    const d = await drag('target', 1, theme + '-moving');
    const light = d.during.vehicleLighting;
    assert(light.headlights[0].target[0] > light.headlights[0].position[0]);
    assert(light.rear.target[0] < light.rear.position[0]);
    assert(light.rear.distance < light.headlights[0].distance);
    assert(light.rear.angle > light.headlights[0].angle);
    const back = await drag('target', -1, theme + '-reverse');
    assert(back.during.vehicleLighting.rear.intensity >= 2);
    assert.equal(await c.evaluate(`document.querySelector('.stats b').textContent`), '2');
    await c.click('復原');
    assert.equal(await c.evaluate(`document.querySelector('.stats b').textContent`), '1');
    await c.click('復原');
    results.push({
      theme,
      idlePower: idle.vehicleLighting.headlights[0].intensity,
      movingPower: light.headlights[0].intensity,
      peakSmoke: d.peak,
      brakePower: d.brake.vehicleLighting.rear.intensity
    });
  }
  assert(results[2].movingPower > results[1].movingPower && results[1].movingPower > results[0].movingPower);
  await load('neon');
  const vertical = await drag('blocker', 1, 'vertical-car');
  assert(vertical.during.vehicleLighting.headlights[0].target[2] > vertical.during.vehicleLighting.headlights[0].position[2]);
  for (const theme of ['day', 'neon']) for (const quality of ['high', 'standard']) {
    await load(theme, quality, 55, true);
    await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);
    const before = await snap();
    const p = await points('target', 1);
    await c.send('Input.dispatchMouseEvent', {type:'mousePressed', x:p.from.x, y:p.from.y, button:'left', buttons:1, clickCount:1});
    // Drive continuous motion inside RAF so CDP round trips do not cap input/FPS.
    // Real CDP pointer selection/release and drag/undo are verified above.
    const elapsed=await c.evaluate(`new Promise(resolve=>{const p=${JSON.stringify(p)},canvas=document.querySelector('.garage-canvas'),start=performance.now();function step(now){const elapsed=now-start,t=.5-.5*Math.cos(elapsed*.004);canvas.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,pointerType:'mouse',isPrimary:true,button:-1,buttons:1,clientX:p.from.x+(p.to.x-p.from.x)*t,clientY:p.from.y+(p.to.y-p.from.y)*t}));if(elapsed>=3500)resolve(elapsed);else requestAnimationFrame(step);}requestAnimationFrame(step);})`);
    const after = await snap();
    perf.push({
      quality,
      theme,
      continuousDragFPS: (after.performance.frames - before.performance.frames) / (elapsed / 1000),
      calls: after.calls,
      profile: after.performance.profile
    });
    await c.send('Input.dispatchMouseEvent', {type:'mouseReleased', x:p.from.x,y:p.from.y,button:'left',clickCount:1});
    await shot('fleet-' + theme + '-' + quality);
  }
  await load('neon', 'high', 90);
  await drag('target', 1, 'overhead');
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await load('neon', 'standard', 55);
  await shot('mobile');
  assert.equal(await c.evaluate('document.documentElement.scrollWidth>innerWidth'), false);
  assert.deepEqual(errors, []);
  writeFileSync(new URL('verification.json', dir), JSON.stringify({
    results,
    perf,
    vertical: 'Forward +Z and rear -Z verified',
    errors
  }, null, 2));
  console.log(JSON.stringify({
    results,
    perf,
    errors
  }, null, 2));
} finally {
  await c.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 20,
    y: 20,
    button: 'left',
    clickCount: 1
  }).catch(() => {});
  await c.send('Emulation.clearDeviceMetricsOverride');
  await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);
  c.close();
}
