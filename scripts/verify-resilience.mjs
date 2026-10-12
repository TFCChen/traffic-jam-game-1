import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { connect } from "./cdp-test.mjs";
import { evidenceDir } from "./ci-evidence.mjs";
import { solveLevel } from "../src/gameEngine.js";
const { send, evaluate, until, click, sleep, onEvent, close } = await connect(
  process.argv[2],
);
const saved = await evaluate(
  "Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))",
);
const fixture = new URL("import-fixture.json", evidenceDir);
const results = [];
const ready = () =>
  until(
    "(()=>{const c=document.querySelector('.garage-canvas'),s=c?.garageInspection?.snapshot(),r=c?.getBoundingClientRect();return s?.ready&&s.sceneKey===s.performance.renderedSceneKey&&s.performance.viewport?.width===r.width&&s.performance.viewport?.height===r.height&&document.querySelector('.game-column')?.getAttribute('aria-busy')==='false'})()",
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
async function mouseClick(point) {
  await send("Input.dispatchMouseEvent", {type:"mousePressed", ...point, button:"left", clickCount:1});
  await send("Input.dispatchMouseEvent", {type:"mouseReleased", ...point, button:"left", clickCount:1});
  await sleep(100);
}
async function selectCar(id) {
  const point = await evaluate(`(()=>{const g=document.querySelector('.garage-canvas').garageInspection,c=g.snapshot().cars.find(c=>c.id===${JSON.stringify(id)});for(const h of [.55,.8,.35,1]){const p=g.project(c.position[0],h,c.position[2]);if(g.pick(p.x,p.y)===c.id)return p}return null})()`);
  assert.ok(point, `Car ${id} must be selectable by pointer`);
  await mouseClick(point);
}
async function pressKey(key, code) {
  await send("Input.dispatchKeyEvent", {type:"keyDown", key, code:key, windowsVirtualKeyCode:code});
  await send("Input.dispatchKeyEvent", {type:"keyUp", key, code:key, windowsVirtualKeyCode:code});
}
try {
  const initialOrigin = await evaluate("performance.timeOrigin");
  await evaluate(
    "(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);localStorage.setItem('traffic-jam-tutorial-v1','true');localStorage.setItem('traffic-jam-custom-levels-v2','{}');location.reload();})()",
  );
  await until(`performance.timeOrigin!==${initialOrigin}`);
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
  await until(
    "/匯入失敗/.test(document.querySelector('.instruction').textContent)",
  );
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
  await until(
    "/備份已合併/.test(document.querySelector('.instruction').textContent)",
  );
  assert.match(
    await evaluate("document.querySelector('.instruction').textContent"),
    /備份已合併/,
  );
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('traffic-jam-draft-v1')).data.title"), "匯入草稿");
  await click("編輯器");
  await ready();
  assert.equal(
    await evaluate("document.querySelector('.editor-actions input').value"),
    "",
  );
  assert.equal(await evaluate("document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length"), 0);
  for(const col of [.5,1.5]) await mouseClick(await evaluate(`document.querySelector('.garage-canvas').garageInspection.project(${col},.055,2.5)`));
  await until("document.querySelector('.garage-canvas').garageInspection.snapshot().cars.length===1");
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
    "File import preserves its named draft; a new editor starts blank, and existing-car drag supports undo",
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
  await ready();
  await evaluate("document.querySelector('.utility-menu').open=true");
  await click("通關演示");
  await until("document.querySelector('.goal-intro')?.open===true");
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
  await pressKey("Escape", 27);
  await until("!document.querySelector('dialog')?.open");
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')||document.activeElement.textContent.trim()"), "車庫設定");
  results.push(
    "Demonstration closes with Escape; settings restore focus and a 200%-equivalent viewport retains controls and 44 px targets",
  );
  await send("Emulation.clearDeviceMetricsOverride");
  await ready();
  assert.equal(await evaluate("document.querySelector('.vehicle-picker')===null"), true);
  const firstLevel=JSON.parse(readFileSync(new URL('../public/levels/level-001.json',import.meta.url),'utf8'));
  const firstMove=solveLevel(firstLevel.cars).moves[0];
  const firstCar=firstLevel.cars.find(c=>c.id===firstMove.carId);
  await selectCar(firstMove.carId);
  assert.ok(
    await evaluate(
      "!!document.querySelector('.garage-canvas').garageInspection.snapshot()",
    ),
  );
  const movesBefore = await evaluate(
    "Number(document.querySelector('.stats b').textContent)",
  );
  const key=firstCar.dir==='H'?(firstMove.delta>0?'ArrowRight':'ArrowLeft'):(firstMove.delta>0?'ArrowDown':'ArrowUp');
  await pressKey(key, {ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40}[key]);
  await until(
    `Number(document.querySelector('.stats b').textContent)===${movesBefore + 1}`,
  );
  await click("復原");
  assert.equal(
    await evaluate("Number(document.querySelector('.stats b').textContent)"),
    movesBefore,
  );
  results.push("Selecting a car on the board enables keyboard movement and undo");
  const beforeFailure = await evaluate(
    "localStorage.getItem('traffic-jam-progress-v2')",
  );
  await send("Network.setBypassServiceWorker", { bypass: true });
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  const unsubscribe = onEvent("Fetch.requestPaused", ({ requestId }) => {
    send("Fetch.fulfillRequest", {
      requestId,
      responseCode: 503,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from("{}").toString("base64"),
    }).catch(console.error);
  });
  try {
    await send("Fetch.enable", {
      patterns: [
        { urlPattern: "*/levels/index.json", requestStage: "Request" },
      ],
    });
    const origin = await evaluate("performance.timeOrigin");
    await send("Page.reload", { ignoreCache: true });
    await until(`performance.timeOrigin!==${origin}`);
    await ready();
    await until(
      "document.querySelector('.stage-heading h2')?.textContent==='暫時車庫'",
    );
    for (const [carId, key, code] of [
      ["block", "ArrowUp", 38],
      ...Array.from({ length: 4 }, () => ["target", "ArrowRight", 39]),
    ]) {
      await selectCar(carId);
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code: key,
        windowsVirtualKeyCode: code,
      });
      await send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code: key,
        windowsVirtualKeyCode: code,
      });
      await sleep(120);
    }
    await until("!!document.querySelector('.win-card')");
    assert.equal(
      await evaluate("localStorage.getItem('traffic-jam-progress-v2')"),
      beforeFailure,
    );
    results.push(
      "503 index fallback can be played without overwriting official progress",
    );
  } finally {
    await send("Fetch.disable");
    unsubscribe();
    await send("Network.setBypassServiceWorker", { bypass: false });
  }
  writeFileSync(
    new URL("resilience.json", evidenceDir),
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
