import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { connect } from './cdp-test.mjs';
const c = await connect(process.argv[2]);
const dir = new URL(process.env.VERIFY_ATMOSPHERE_OUTPUT_DIR ?? '../docs/atmosphere-2026-10-07/', import.meta.url); mkdirSync(dir, { recursive: true });
const snap = () => c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
const saved = await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`);
let current = { pitch: 65, yaw: 25, zoom: .85, quality: 'high', theme: 'day' };
await c.send('Network.enable'); await c.send('Network.setBypassServiceWorker', { bypass: true }); await c.send('Network.setCacheDisabled', { cacheDisabled: true });
async function settings(value) {
  current = { ...current, ...value }; const origin = await c.evaluate('performance.timeOrigin');
  const progress = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, { completed: true, stars: 3, bestMoves: 10 }]));
  await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(${JSON.stringify(progress)}));localStorage.setItem('traffic-jam-scene',JSON.stringify(${JSON.stringify(current)}));location.reload()`);
  await c.until(`performance.timeOrigin!==${origin}`); await c.until(`document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready`);
}
const errors = []; await c.send('Runtime.enable');
c.onEvent('Runtime.consoleAPICalled', e => { if (e.type === 'error') errors.push(e.args.map(a => a.value ?? a.description).join(' ')); });
c.onEvent('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails.text));
async function shot(name) { writeFileSync(new URL(name + '.png', dir), Buffer.from((await c.send('Page.captureScreenshot')).data, 'base64')); }
try {
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true }); await c.send('Page.bringToFront');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await settings({ theme: 'neon', quality: 'high', pitch: 30, yaw: 70, zoom: 2, focusX: -3.7, focusZ: -1.9 });
  await c.sleep(1500); const a = await snap(); await shot('cafe-night-detail');
  await c.sleep(1600); const b = await snap(); await shot('cafe-night-breeze');
  assert(a.atmosphere.enabled && a.atmosphere.cafeLight > 0);
  assert.notDeepEqual(a.atmosphere.wind, b.atmosphere.wind);
  assert.equal(a.performance.shadowUpdates, b.performance.shadowUpdates);
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await c.sleep(800); const reduced = await snap();
  assert.deepEqual(reduced.atmosphere.wind, [0, 0, 0, 0]); assert.equal(reduced.atmosphere.activeLeaves, 0);
  assert(reduced.atmosphere.cafeGlow > 0);
  await c.send('Emulation.setEmulatedMedia', { features: [] });
  await settings({ quality: 'saver' }); await c.sleep(500);
  assert.equal((await snap()).atmosphere.enabled, false);
  const profiles = [];
  for (const [name, width, height, dpr, theme] of [['desktop-day',1440,1000,1,'day'],['desktop-night',1440,1000,1,'neon'],['mobile-day',393,844,3,'day']]) {
    await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: width < 500 });
    await settings({ quality: 'high', theme, pitch: 65, yaw: 25, zoom: .85, focusX: 0, focusZ: 0 });
    await c.sleep(1000); await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);
    await c.sleep(5000); const s = await snap(); profiles.push({ name, atmosphere: s.atmosphere, performance: s.performance });
    await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(false)`);
  }
  assert.deepEqual(errors, []);
  writeFileSync(new URL('atmosphere-inspection.json', dir), JSON.stringify({ animatedWithoutShadowRefresh: true, reducedMotion: true, saver: true, profiles, errors }, null, 2));
  console.log('Ambient motion, night window, reduced motion, saver and desktop/mobile profiling passed');
} finally {
  await c.send('Emulation.setEmulatedMedia', { features: [] }); await c.send('Emulation.clearDeviceMetricsOverride');
  await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`); c.close();
}
