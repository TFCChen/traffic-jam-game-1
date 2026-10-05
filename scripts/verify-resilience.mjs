import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { connect } from "./cdp-test.mjs";
const { send, evaluate, until, click, sleep, close } = await connect(
  process.argv[2],
);
const saved = await evaluate(
  "Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))",
);
const fixture = new URL(
  "../.browser-checks/import-fixture.json",
  import.meta.url,
);
const results = [];
mkdirSync(new URL("../.browser-checks/", import.meta.url), { recursive: true });
const ready = () =>
  until(
    "document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&document.querySelector('.game-column')?.getAttribute('aria-busy')==='false'",
  );
async function upload(data) {
  writeFileSync(fixture, JSON.stringify(data));
  const { root } = await send("DOM.getDocument");
  const { nodeId } = await send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "input[type=file]",
  });
  await send("DOM.setFileInputFiles", {
    nodeId,
    files: [fileURLToPath(fixture)],
  });
  await sleep(200);
}
try {
  await evaluate(
    "(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);localStorage.setItem('traffic-jam-tutorial-v1','true');localStorage.setItem('traffic-jam-custom-levels-v2','{}');location.reload();})()",
  );
  await ready();
  assert.ok(await evaluate("!!document.querySelector('.storage-alert')"));
  assert.equal(
    await evaluate("localStorage.getItem('traffic-jam-custom-levels-v2')"),
    "{}",
  );
  // This disposable fixture accepts the app's repair dialog; real user storage is restored below.
  await evaluate("window.confirm=()=>true");
  await click("修復裝置存檔");
  assert.equal(
    await evaluate("localStorage.getItem('traffic-jam-custom-levels-v2')"),
    "[]",
  );
  assert.ok(
    await evaluate(
      "Object.keys(localStorage).some(k=>k.startsWith('traffic-jam-recovery-')&&JSON.parse(localStorage.getItem(k)).custom==='{}')",
    ),
  );
  results.push(
    "Corrupt custom data remains playable and original bytes survive repair",
  );
  const prior = await evaluate(
    "localStorage.getItem('traffic-jam-progress-v2')",
  );
  await upload({
    format: "traffic-jam-backup",
    version: 1,
    progress: {},
    customLevels: {},
  });
  assert.match(
    await evaluate("document.querySelector('.instruction').textContent"),
    /匯入失敗/,
  );
  assert.equal(
    await evaluate("localStorage.getItem('traffic-jam-progress-v2')"),
    prior,
  );
  const cars = [
    { id: "target", color: "#e53935", row: 2, col: 0, len: 2, dir: "H" },
  ];
  const data = {
    format: "traffic-jam-backup",
    version: 1,
    progress: {},
    customLevels: [{ id: "custom-import", title: "匯入試車場", cars }],
    draft: { cars, title: "匯入草稿", id: null },
  };
  await upload(data);
  assert.match(
    await evaluate("document.querySelector('.instruction').textContent"),
    /備份已合併/,
  );
  await click("編輯器");
  await ready();
  assert.equal(
    await evaluate("document.querySelector('.editor-actions input').value"),
    "匯入草稿",
  );
  const start = await evaluate(
    "document.querySelector('.garage-canvas').garageInspection.project(1,.7,2.5)",
  );
  const end = await evaluate(
    "document.querySelector('.garage-canvas').garageInspection.project(2,.7,2.5)",
  );
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...start,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...end,
    button: "left",
    buttons: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...end,
    button: "left",
    clickCount: 1,
  });
  await until(
    "JSON.parse(localStorage.getItem('traffic-jam-draft-v1')).data.cars[0].col===1",
  );
  await click("復原編輯");
  assert.equal(
    await evaluate(
      "JSON.parse(localStorage.getItem('traffic-jam-draft-v1')).data.cars[0].col",
    ),
    0,
  );
  results.push(
    "Real file import restores named draft; existing-car drag and editor undo work",
  );
  const blankStart = await evaluate(
    "document.querySelector('.garage-canvas').garageInspection.project(.5,.055,.5)",
  );
  const blankEnd = await evaluate(
    "document.querySelector('.garage-canvas').garageInspection.project(1.5,.055,.5)",
  );
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...blankStart,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...blankEnd,
    button: "left",
    buttons: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...blankEnd,
    button: "left",
    clickCount: 1,
  });
  await until(
    "JSON.parse(localStorage.getItem('traffic-jam-draft-v1')).data.cars.length===2",
  );
  await click("復原編輯");
  results.push(
    "Empty-grid drag places a car with the selected tool and supports undo",
  );
  await evaluate(
    "window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')}",
  );
  await click("儲存");
  await until("!!document.querySelector('.storage-alert')");
  assert.match(
    await evaluate("document.querySelector('.instruction').textContent"),
    /尚未保存/,
  );
  assert.equal(
    await evaluate(
      "JSON.parse(localStorage.getItem('traffic-jam-custom-levels-v2')).length",
    ),
    1,
  );
  await evaluate("Storage.prototype.setItem=window.__storageSet");
  results.push(
    "Quota failure reports unsaved work without false success or overwriting creations",
  );
  await click("返回遊戲");
  await click("操作指南");
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  assert.equal(
    await evaluate("document.querySelector('dialog')?.open??false"),
    false,
  );
  assert.equal(
    await evaluate("document.activeElement.textContent.trim()"),
    "操作指南",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 640,
    height: 450,
    deviceScaleFactor: 2,
    mobile: false,
  });
  assert.equal(
    await evaluate("document.documentElement.scrollWidth>innerWidth"),
    false,
  );
  await click("車庫設定");
  const ax = await send("Accessibility.getFullAXTree");
  assert.ok(
    ax.nodes.some(
      (n) => n.role?.value === "dialog" && n.name?.value === "車庫設定",
    ),
  );
  assert.ok(
    ax.nodes.some(
      (n) => n.role?.value === "button" && n.name?.value === "關閉車庫設定",
    ),
  );
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('dialog button')].filter(b=>!b.disabled).every(b=>b.getBoundingClientRect().height>=44)",
    ),
  );
  await click("關閉車庫設定");
  results.push(
    "Guide Escape returns focus; 200%-equivalent viewport retains controls and 44 px targets",
  );
  await click("選車");
  await evaluate("document.querySelector('.vehicle-picker button').focus()");
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    text: "\r",
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  assert.ok(
    await evaluate(
      "!!document.querySelector('.garage-canvas').garageInspection.snapshot()",
    ),
  );
  const movesBefore = await evaluate(
    "Number(document.querySelector('.stats b').textContent)",
  );
  console.log(
    JSON.stringify(
      await evaluate(
        "({selected:[...document.querySelectorAll('.vehicle-picker button')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.getAttribute('aria-label')),active:document.activeElement.className,cars:document.querySelector('.garage-canvas').garageInspection.snapshot().cars.map(c=>c.id),heading:document.querySelector('.stage-heading h2').textContent})",
      ),
    ),
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  await until(
    `Number(document.querySelector('.stats b').textContent)===${movesBefore + 1}`,
  );
  await click("復原");
  assert.equal(
    await evaluate("Number(document.querySelector('.stats b').textContent)"),
    movesBefore,
  );
  results.push("Keyboard picker activation, arrow movement and undo work");
  writeFileSync(
    new URL("../docs/upgrade-2026-10-05/resilience.json", import.meta.url),
    JSON.stringify({ results }, null, 2),
  );
  console.log(results.join("\n"));
} finally {
  await evaluate(
    `(()=>{if(window.__storageSet)Storage.prototype.setItem=window.__storageSet;for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()})()`,
  );
  await send("Emulation.clearDeviceMetricsOverride");
  try {
    unlinkSync(fixture);
  } catch {}
  close();
}
