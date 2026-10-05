import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { connect } from "./cdp-test.mjs";
import { solveLevel } from "../src/gameEngine.js";
const { send, evaluate, sleep, until, click, close } = await connect(
  process.argv[2],
);
const keys = [
    "traffic-jam-progress-v2",
    "traffic-jam-custom-levels-v2",
    "traffic-jam-scene",
    "traffic-jam-session-v1",
    "traffic-jam-draft-v1",
    "traffic-jam-tutorial-v1",
  ],
  saved = await evaluate(
    `Object.fromEntries(${JSON.stringify(keys)}.map(k=>[k,localStorage.getItem(k)]))`,
  );
const dir = new URL("../docs/upgrade-2026-10-05/", import.meta.url);
mkdirSync(dir, { recursive: true });
const results = [];
const ready = () =>
  until(
    "document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&document.querySelector('.game-column')?.getAttribute('aria-busy')==='false'",
  );
const shot = async (name) => {
  await sleep(450);
  writeFileSync(
    new URL(`${name}.png`, dir),
    Buffer.from(
      (await send("Page.captureScreenshot", { format: "png" })).data,
      "base64",
    ),
  );
};
const point = async (row, col) =>
  evaluate(
    `document.querySelector('.garage-canvas').garageInspection.project(${col + 0.5},.055,${row + 0.5})`,
  );
async function mouseClick(p) {
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...p,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...p,
    button: "left",
    clickCount: 1,
  });
  await sleep(100);
}
async function level(id) {
  await click("關卡");
  await evaluate(
    `document.querySelector('.level-grid button[aria-label^="第 ${id} 關"]').click()`,
  );
  await ready();
}
try {
  await evaluate(
    "(async()=>{for(const reg of await navigator.serviceWorker.getRegistrations())await reg.unregister();for(const key of await caches.keys())if(key.startsWith('traffic-jam-'))await caches.delete(key);})()",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(
    `(()=>{for(const k of ${JSON.stringify(keys)})localStorage.removeItem(k);localStorage.setItem('traffic-jam-tutorial-v1','true');location.reload()})()`,
  );
  await ready();
  const projection = () =>
    evaluate(
      "document.querySelector('.garage-canvas').garageInspection.project(0,.055,0)",
    );
  const before = await projection();
  await click("提示");
  await ready();
  assert.deepEqual(await projection(), before);
  results.push("Hint preserves board projection");
  await shot("01-play");
  await click("編輯器");
  await ready();
  await click("清空");
  await mouseClick(await point(2, 0));
  await mouseClick(await point(5, 5));
  await mouseClick(await point(2, 1));
  assert.equal(
    await evaluate(
      "document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length",
    ),
    1,
  );
  const editorBefore = await projection();
  await click("驗證");
  await ready();
  assert.deepEqual(await projection(), editorBefore);
  results.push(
    "Invalid endpoint retains start; validation preserves projection",
  );
  await click("清空");
  await click("復原編輯");
  assert.equal(
    await evaluate(
      "document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length",
    ),
    1,
  );
  await click("重做編輯");
  assert.equal(
    await evaluate(
      "document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length",
    ),
    0,
  );
  await click("復原編輯");
  await evaluate(
    "(()=>{const e=document.querySelector('.editor-actions input');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(e,'河畔試車場');e.dispatchEvent(new Event('input',{bubbles:true}));})()",
  );
  await sleep(150);
  await click("返回遊戲");
  await click("編輯器");
  assert.equal(
    await evaluate(
      "document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length",
    ),
    1,
  );
  await evaluate("location.reload()");
  await ready();
  await click("編輯器");
  assert.equal(
    await evaluate(
      "document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length",
    ),
    1,
  );
  assert.equal(
    await evaluate("document.querySelector('.editor-actions input').value"),
    "河畔試車場",
  );
  results.push("Undo/redo and named draft survive leave/reload");
  await shot("02-editor");
  await click("試玩");
  await ready();
  assert.equal(
    await evaluate("document.querySelector('.stage-heading h2').textContent"),
    "河畔試車場",
  );
  await click("返回草稿");
  assert.equal(
    await evaluate(
      "document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length",
    ),
    1,
  );
  await click("儲存");
  await ready();
  assert.equal(
    await evaluate(
      "JSON.parse(localStorage.getItem('traffic-jam-custom-levels-v2'))[0].title",
    ),
    "河畔試車場",
  );
  results.push("Unsaved trial returns to same draft; named save succeeds");
  await click("返回遊戲");
  await level(1);
  const raw = JSON.parse(
      readFileSync(new URL("../public/levels/level-001.json", import.meta.url)),
    ),
    move = solveLevel(raw.cars).moves[0];
  const fromTo = await evaluate(
    `(()=>{const a=document.querySelector('.garage-canvas').garageInspection,c=a.snapshot().cars.find(c=>c.id===${JSON.stringify(move.carId)}),[x,,z]=c.position;return {from:a.project(x,.55,z),to:a.project(x+(c.dir==='H'?${move.delta}:0),.55,z+(c.dir==='V'?${move.delta}:0))};})()`,
  );
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...fromTo.from,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...fromTo.to,
    button: "left",
    buttons: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...fromTo.to,
    button: "left",
    clickCount: 1,
  });
  await until("document.querySelector('.stats b').textContent==='1'");
  await evaluate("location.reload()");
  await ready();
  assert.equal(
    await evaluate("document.querySelector('.stats b').textContent"),
    "1",
  );
  await click("復原");
  assert.equal(
    await evaluate("document.querySelector('.stats b').textContent"),
    "0",
  );
  results.push("Reload resumes board, moves and undo history");
  const instance = await evaluate(
    "document.querySelector('.garage-canvas').garageInspection.snapshot().instanceId",
  );
  assert.ok(Number.isInteger(instance));
  const memories = [];
  const switchTimes = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    await level(i % 2 ? 1 : 40);
    switchTimes.push(performance.now() - start);
    await sleep(50);
    const snap = await evaluate(
      "document.querySelector('.garage-canvas').garageInspection.snapshot()",
    );
    assert.equal(snap.instanceId, instance);
    memories.push(snap.memory);
    if (i % 20 === 19) console.log(`Stable scene switches: ${i + 1}`);
  }
  // Hidden/offscreen meshes may not upload until a rendered frame. Detect growth,
  // without requiring identical counts while resources are disposed and uploaded.
  for (const field of ["geometries", "textures"]) {
    const warmMax = Math.max(...memories.slice(0, 20).map((m) => m[field]));
    const finalMax = Math.max(...memories.slice(-20).map((m) => m[field]));
    assert.ok(
      finalMax <= warmMax + 2,
      `${field} must not grow across repeated level switches`,
    );
  }
  const switchP95 = [...switchTimes].sort((a, b) => a - b)[94];
  results.push("100 level switches reuse one renderer");
  await level(1);
  await send("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await shot("03-mobile");
  await click("車庫設定");
  const targets = await evaluate(
    "[...document.querySelectorAll('dialog button')].filter(b=>!b.disabled).map(b=>({height:b.getBoundingClientRect().height,text:b.textContent.trim()}))",
  );
  assert.ok(targets.every((v) => v.height >= 44));
  await shot("04-settings");
  await click("關閉車庫設定");
  results.push("Mobile settings targets >=44px");
  await until("!!navigator.serviceWorker.controller");
  await send("Network.enable");
  await send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await evaluate("location.reload()");
  await ready();
  await level(40);
  await until(
    "/離線.*遊玩/.test(document.querySelector('.offline-status').textContent)",
  );
  await shot("05-offline");
  results.push(
    "Offline reload and level 40 assets load from versioned snapshot",
  );
  await send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await evaluate(
    "document.querySelector('.garage-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()",
  );
  await until("!!document.querySelector('.scene-fallback')");
  await click("重試 3D");
  await ready();
  results.push("WebGL loss fallback and 3D retry");
  writeFileSync(
    new URL("verification.json", dir),
    JSON.stringify(
      {
        results,
        memories,
        switchTimes,
        switchP95,
        switchTiming:
          "Includes panel button click, 100 ms test wait and readiness polling; not pure renderer time",
      },
      null,
      2,
    ),
  );
  console.log(results.join("\n"));
} finally {
  await send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await evaluate(
    `(()=>{for(const [k,v]of Object.entries(${JSON.stringify(saved)}))v===null?localStorage.removeItem(k):localStorage.setItem(k,v);location.reload()})()`,
  );
  await send("Emulation.clearDeviceMetricsOverride");
  close();
}
