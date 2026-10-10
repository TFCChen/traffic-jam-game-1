import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { legalMovesForCar } from "../src/gameEngine.js";
import { connect } from "./cdp-test.mjs";
const { send, evaluate, sleep, until, click, close } = await connect(
  process.argv[2],
);
const saved = await evaluate(
  "Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))",
);
const dir = new URL("../docs/camera-2026-10-05/", import.meta.url);
mkdirSync(dir, { recursive: true });
const results = [];
const snapshot = () =>
  evaluate(
    "document.querySelector('.garage-canvas').garageInspection.snapshot()",
  );
function assertSameCenter(before, after) {
  assert.ok(
    Math.hypot(...before.viewCenter.map((v, i) => v - after.viewCenter[i])) <
      1e-8,
    "Orbit keeps the current viewport center fixed in world space",
  );
}
const ready = () =>
  until(
    "(()=>{const c=document.querySelector('.garage-canvas'),s=c?.garageInspection?.snapshot(),r=c?.getBoundingClientRect();return s?.ready&&s.sceneKey===s.performance.renderedSceneKey&&s.performance.viewport?.width===r.width&&s.performance.viewport?.height===r.height&&document.querySelector('.stage-heading h2')?.textContent==='第 01 關'&&document.querySelector('.game-column')?.getAttribute('aria-busy')==='false'})()",
  );
const rect = () =>
  evaluate(
    "(()=>{const r=document.querySelector('.garage-canvas').getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}})()",
  );
const shot = async (name) => {
  await sleep(200);
  writeFileSync(
    new URL(name + ".png", dir),
    Buffer.from(
      (await send("Page.captureScreenshot", { format: "png" })).data,
      "base64",
    ),
  );
};
async function mouseDrag(button, dx, dy, modifiers = 0) {
  const r = await rect(),
    from = { x: r.x + r.w * 0.5, y: r.y + r.h * 0.5 };
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...from,
    button,
    buttons: button === "right" ? 2 : 4,
    clickCount: 1,
    modifiers,
  });
  for (let i = 1; i <= 5; i++) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: from.x + (dx * i) / 5,
      y: from.y + (dy * i) / 5,
      button,
      buttons: button === "right" ? 2 : 4,
      modifiers,
    });
    await sleep(25);
  }
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: from.x + dx,
    y: from.y + dy,
    button,
    clickCount: 1,
    modifiers,
  });
  await sleep(250);
}
async function touch(type, points) {
  await send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((p) => ({
      ...p,
      radiusX: 7,
      radiusY: 7,
      force: 1,
    })),
  });
  await sleep(50);
}
async function carDrag() {
  const cars = JSON.parse(
    readFileSync(new URL("../public/levels/level-001.json", import.meta.url)),
  ).cars;
  const moves = cars.flatMap((car) => legalMovesForCar(cars, car.id));
  const p = await evaluate(
    `(()=>{const canvas=document.querySelector('.garage-canvas'),a=canvas.garageInspection,r=canvas.getBoundingClientRect(),inside=p=>p.x>r.left+8&&p.x<r.right-8&&p.y>r.top+8&&p.y<r.bottom-8;for(const m of ${JSON.stringify(moves)}){const c=a.snapshot().cars.find(c=>c.id===m.carId),[x,,z]=c.position;for(const h of [.55,.8,1.2,1,.35]){const from=a.project(x,h,z),to=a.project(x+(c.dir==='H'?m.delta:0),h,z+(c.dir==='V'?m.delta:0));if(inside(from)&&inside(to)&&a.pick(from.x,from.y)===c.id)return {from,to,id:c.id};}}return null})()`,
  );
  assert.ok(
    p,
    "A visible legal vehicle must remain selectable after view changes",
  );
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...p.from,
    button: "left",
    clickCount: 1,
  });
  assert.equal(
    await evaluate("document.querySelector('.garage-canvas').dataset.dragging"),
    p.id,
  );
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...p.to,
    button: "left",
    buttons: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...p.to,
    button: "left",
    clickCount: 1,
  });
  await until("document.querySelector('.stats b').textContent==='1'");
}
try {
  await send("Network.enable");
  await send("Network.setBypassServiceWorker", { bypass: true });
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(
    "(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);localStorage.setItem('traffic-jam-tutorial-v1','true')})()",
  );
  const origin = await evaluate("performance.timeOrigin");
  await send("Page.reload", { ignoreCache: true });
  await until(`performance.timeOrigin!==${origin}`);
  await ready();
  await evaluate(
    "document.querySelector('.garage-canvas').scrollIntoView({block:'center'})",
  );
  await sleep(200);
  const initial = await snapshot();
  await mouseDrag("right", 100, 45);
  const rotated = await snapshot();
  assert.notEqual(rotated.settings.yaw, initial.settings.yaw);
  assert.equal(rotated.settings.yaw, initial.settings.yaw - 30);
  assert.ok(rotated.settings.pitch > initial.settings.pitch);
  assert.deepEqual(rotated.cameraFrustum, initial.cameraFrustum);
  assert.equal(rotated.settings.zoom, initial.settings.zoom);
  assertSameCenter(initial, rotated);
  assert.equal(
    await evaluate("document.querySelector('.stats b').textContent"),
    "0",
  );
  results.push(
    "Right-button orbit reverses pitch direction, preserves yaw direction and keeps projection scale fixed",
  );
  let r = await rect();
  const point = { x: r.x + r.w * 0.63, y: r.y + r.h * 0.43 };
  const anchor = await evaluate(
    `(()=>{const a=document.querySelector('.garage-canvas').garageInspection;return a.project(3,.055,3)})()`,
  );
  await send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    ...anchor,
    deltaX: 0,
    deltaY: -450,
  });
  await sleep(300);
  const anchoredAfter = await evaluate(
    "document.querySelector('.garage-canvas').garageInspection.project(3,.055,3)",
  );
  console.log(
    JSON.stringify({
      anchor,
      anchoredAfter,
      anchorError: Math.hypot(
        anchoredAfter.x - anchor.x,
        anchoredAfter.y - anchor.y,
      ),
      camera: (await snapshot()).settings,
    }),
  );
  assert.ok(
    Math.hypot(anchoredAfter.x - anchor.x, anchoredAfter.y - anchor.y) < 1.5,
    "Zoom keeps the cursor's world point fixed within native pointer pixel rounding",
  );
  assert.ok((await snapshot()).settings.zoom > 1);
  const beforeZoomedOrbit = await snapshot();
  await mouseDrag("right", 40, -60);
  const zoomed = await snapshot();
  assert.equal(zoomed.settings.zoom, beforeZoomedOrbit.settings.zoom);
  assert.ok(
    Math.abs(
      zoomed.cameraFrustum.width - beforeZoomedOrbit.cameraFrustum.width,
    ) < 1e-12,
  );
  assert.ok(
    Math.abs(
      zoomed.cameraFrustum.height - beforeZoomedOrbit.cameraFrustum.height,
    ) < 1e-12,
  );
  assert.ok(zoomed.settings.pitch < beforeZoomedOrbit.settings.pitch);
  assertSameCenter(beforeZoomedOrbit, zoomed);
  results.push(
    "Orbit after wheel zoom retains the chosen projection scale; upward drag lowers pitch",
  );
  assert.notEqual(zoomed.settings.panX, 0);
  await mouseDrag("right", 65, -30, 8);
  const shifted = await snapshot();
  assert.equal(shifted.settings.yaw, zoomed.settings.yaw);
  assert.equal(shifted.settings.pitch, zoomed.settings.pitch);
  assert.notEqual(shifted.settings.panX, zoomed.settings.panX);
  await mouseDrag("middle", -35, 25);
  assert.notEqual((await snapshot()).settings.panX, shifted.settings.panX);
  const pannedBeforeOrbit = await snapshot();
  await mouseDrag("right", 45, 20);
  assertSameCenter(pannedBeforeOrbit, await snapshot());
  results.push(
    "Orbit after zoom and both pan gestures keeps the viewed ground point centered",
  );
  results.push(
    "Wheel zoom, Shift-right pan and middle-button pan preserve orbit angles",
  );
  await carDrag();
  await shot("01-desktop-detail");
  await click("復原");
  await click("重置視角");
  await sleep(200);
  assert.equal((await snapshot()).settings.zoom, 1);
  assert.equal((await snapshot()).settings.panX, 0);
  results.push(
    "Projected vehicle picking and legal drag still work after orbit/zoom/pan; reset restores framing",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await sleep(200);
  await evaluate(
    "document.querySelector('.garage-canvas').scrollIntoView({block:'center'})",
  );
  await sleep(100);
  r = await rect();
  const a = { id: 1, x: r.x + r.w * 0.34, y: r.y + r.h * 0.5 },
    b = { id: 2, x: r.x + r.w * 0.66, y: r.y + r.h * 0.5 };
  const beforeTouch = await snapshot();
  const street = await evaluate(
    "(()=>{const c=document.querySelector('.garage-canvas'),r=c.getBoundingClientRect(),a=c.garageInspection;for(const x of [-1,-.4,6.4,7])for(const z of [-1,0,1,2,3,4,5,6,7]){const p=a.project(x,.055,z);if(p.x>r.left+40&&p.x<r.right-40&&p.y>r.top+40&&p.y<r.bottom-40&&!a.pick(p.x,p.y))return p;}return null})()",
  );
  assert.ok(street, "Visible street supports one-finger orbit");
  await touch("touchStart", [{ id: 8, ...street }]);
  await touch("touchMove", [{ id: 8, x: street.x + 30, y: street.y + 15 }]);
  await touch("touchEnd", []);
  assert.notEqual((await snapshot()).settings.yaw, beforeTouch.settings.yaw);
  assert.ok((await snapshot()).settings.pitch > beforeTouch.settings.pitch);
  assert.deepEqual((await snapshot()).cameraFrustum, beforeTouch.cameraFrustum);
  assertSameCenter(beforeTouch, await snapshot());
  results.push("One-finger street drag rotates the camera without moving cars");
  await click("重置視角");
  await touch("touchStart", [a, b]);
  await touch("touchMove", [
    { ...a, x: a.x + 35, y: a.y + 20 },
    { ...b, x: b.x + 35, y: b.y + 20 },
  ]);
  await touch("touchEnd", []);
  assert.equal((await snapshot()).settings.yaw, beforeTouch.settings.yaw);
  assert.notEqual((await snapshot()).settings.panX, beforeTouch.settings.panX);
  assert.equal(
    await evaluate("document.querySelector('.stats b').textContent"),
    "0",
  );
  results.push(
    "Two-finger drag pans without rotation or committing vehicle movement",
  );
  await click("重置視角");
  await sleep(100);
  const beforePinch = await snapshot();
  await touch("touchStart", [a, b]);
  await touch("touchMove", [
    { ...a, x: a.x - 35 },
    { ...b, x: b.x + 35 },
  ]);
  await touch("touchEnd", []);
  const pinched = await snapshot();
  assert.ok(pinched.settings.zoom > beforePinch.settings.zoom);
  assert.ok(Math.abs(pinched.settings.yaw - beforePinch.settings.yaw) < 0.01);
  assert.ok(
    Math.abs(pinched.settings.pitch - beforePinch.settings.pitch) < 0.01,
  );
  await sleep(100);
  await touch("touchStart", [a, b]);
  await touch("touchMove", [
    { ...a, x: a.x + 35 },
    { ...b, x: b.x + 35 },
  ]);
  await touch("touchEnd", []);
  const panned = await snapshot();
  assert.notEqual(panned.settings.panX, pinched.settings.panX);
  assert.equal(panned.settings.yaw, pinched.settings.yaw);
  results.push(
    "Symmetric pinch zooms without orbit; two-finger drag translates without rotation",
  );
  await shot("02-mobile-detail");
  // Begin on an actual car, then add the second finger: this must cancel the pending move.
  await click("重置視角");
  await sleep(200);
  const carPoint = await evaluate(
    "(()=>{const a=document.querySelector('.garage-canvas').garageInspection,c=a.snapshot().cars.find(c=>c.id==='green'),[x,,z]=c.position;return a.project(x,.6,z)})()",
  );
  const first = { id: 3, ...carPoint },
    second = { id: 4, x: carPoint.x + 75, y: carPoint.y + 60 };
  await touch("touchStart", [first]);
  assert.equal(
    await evaluate("document.querySelector('.garage-canvas').dataset.dragging"),
    "green",
  );
  await touch("touchStart", [first, second]);
  await touch("touchMove", [
    { ...first, x: first.x + 30 },
    { ...second, x: second.x + 30 },
  ]);
  await touch("touchEnd", [{ ...first, x: first.x + 30 }]);
  await touch("touchMove", [{ ...first, x: first.x + 80 }]);
  await touch("touchEnd", []);
  assert.equal(
    await evaluate("document.querySelector('.stats b').textContent"),
    "0",
  );
  assert.equal((await snapshot()).touchPointers, 0);
  await touch("touchStart", [a, b]);
  await touch("touchStart", [a, b, { id: 9, x: a.x, y: a.y + 70 }]);
  assert.equal((await snapshot()).cameraGesture, null);
  await touch("touchCancel", []);
  await touch("touchStart", [a, b]);
  await evaluate("window.dispatchEvent(new Event('blur'))");
  assert.equal((await snapshot()).cameraGesture, null);
  assert.equal((await snapshot()).touchPointers, 0);
  await touch("touchCancel", []);
  results.push(
    "Adding/lifting the second finger cancels the car drag; remaining finger cannot accidentally move a car",
  );
  const persist = JSON.parse(
    await evaluate("localStorage.getItem('traffic-jam-scene')"),
  );
  const time = await evaluate("performance.timeOrigin");
  await send("Page.reload", { ignoreCache: true });
  await until(`performance.timeOrigin!==${time}`);
  await ready();
  assert.equal((await snapshot()).settings.yaw, persist.yaw);
  assert.equal((await snapshot()).settings.zoom, persist.zoom);
  assert.equal((await snapshot()).settings.focusX, persist.focusX);
  assert.equal((await snapshot()).settings.focusZ, persist.focusZ);
  results.push("Camera preferences survive reload");
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('.camera-navigation button')].every(b=>b.getBoundingClientRect().height>=44)",
    ),
  );
  assert.equal(
    await evaluate("document.documentElement.scrollWidth>innerWidth"),
    false,
  );
  await click("編輯器");
  await until(
    "document.querySelector('.stage-heading h2')?.textContent==='關卡工作台'",
  );
  await click("清空");
  await sleep(200);
  await evaluate(
    "document.querySelector('.garage-canvas').scrollIntoView({block:'center'})",
  );
  r = await rect();
  const e1 = { id: 5, x: r.x + r.w * 0.3, y: r.y + r.h * 0.5 },
    e2 = { id: 6, x: r.x + r.w * 0.7, y: r.y + r.h * 0.5 };
  await touch("touchStart", [e1, e2]);
  await touch("touchMove", [
    { ...e1, x: e1.x + 20 },
    { ...e2, x: e2.x + 20 },
  ]);
  await touch("touchCancel", []);
  assert.equal((await snapshot()).cars.length, 0);
  assert.equal((await snapshot()).guide.visible, false);
  assert.equal((await snapshot()).cameraGesture, null);
  await send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await sleep(200);
  assert.equal(
    await evaluate("document.documentElement.scrollWidth>innerWidth"),
    false,
  );
  results.push(
    "Editor camera gestures do not place a car; mobile controls fit and remain >=44 px",
  );
  writeFileSync(
    new URL("verification.json", dir),
    JSON.stringify({ results, initial, rotated, pinched, panned }, null, 2),
  );
  console.log(results.join("\n"));
} finally {
  await send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  }).catch(() => {});
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await send("Emulation.clearDeviceMetricsOverride");
  await send("Network.setBypassServiceWorker", { bypass: false });
  await send("Network.setCacheDisabled", { cacheDisabled: false });
  await evaluate(
    `(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()})()`,
  );
  close();
}
