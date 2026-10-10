// Actual mouse-input replay of all official solutions in an isolated Chrome tab.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { solveLevel } from "../src/gameEngine.js";
const ws = new WebSocket(process.argv[2]);
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let sequence = 0,
  session;
const pending = new Map();
ws.onmessage = (e) => {
  const r = JSON.parse(e.data),
    p = pending.get(r.id);
  if (p) {
    pending.delete(r.id);
    r.error ? p.reject(Error(r.error.message)) : p.resolve(r.result);
  }
};
const send = (method, params = {}, attached = true) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(
      JSON.stringify({
        id,
        method,
        params,
        ...(attached ? { sessionId: session } : {}),
      }),
    );
  });
const targets = await send("Target.getTargets", {}, false),
  page = targets.targetInfos.find(
    (t) => t.type === "page" && t.url.startsWith("http://localhost:4173"),
  );
assert.ok(page);
session = (
  await send(
    "Target.attachToTarget",
    { targetId: page.targetId, flatten: true },
    false,
  )
).sessionId;
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(expression, label) {
  for (let i = 0; i < 300; i++) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw Error(label);
}
const keys = [
  "traffic-jam-progress-v2",
  "traffic-jam-scene",
  "traffic-jam-session-v1",
  "traffic-jam-tutorial-v1",
  "traffic-jam-draft-v1",
];
const saved = await evaluate(
  `Object.fromEntries(${JSON.stringify(keys)}.map(k=>[k,localStorage.getItem(k)]))`,
);
const limit = Number(process.argv[3] ?? 40);
const first = Number(process.argv[4] ?? 1);
assert.ok(Number.isInteger(limit) && limit >= 1 && limit <= 40);
assert.ok(Number.isInteger(first) && first >= 1 && first <= limit);
const catalog = JSON.parse(
  readFileSync(new URL("../public/levels/index.json", import.meta.url)),
);
const index = catalog.slice(first - 1, limit),
  results = [];
const solutions = JSON.parse(
  readFileSync(new URL("../public/levels/solutions.json", import.meta.url)),
);
const fixtureProgress = Object.fromEntries(
  catalog
    .slice(0, first - 1)
    .map((v) => [
      v.id,
      {
        completed: true,
        stars: 3,
        bestMoves: solutions[v.id].solution.moves.length,
        perfect: true,
      },
    ]),
);
try {
  await evaluate(
    "(async()=>{for(const reg of await navigator.serviceWorker.getRegistrations())await reg.unregister();for(const k of await caches.keys())if(k.startsWith('traffic-jam-'))await caches.delete(k);localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1','true');})()",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const previousOrigin = await evaluate("performance.timeOrigin");
  await evaluate(
    `localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(${JSON.stringify(fixtureProgress)}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:60,yaw:-12,theme:'day',quality:'standard',motion:1.2}));location.reload()`,
  );
  await until(
    `performance.timeOrigin!==${previousOrigin}`,
    "New test document",
  );
  if (first > 1) {
    await until(
      "document.querySelector('.game-column')?.getAttribute('aria-busy')==='false'",
      "Initial load",
    );
    await evaluate(
      "[...document.querySelectorAll('.toolbar button')].find(b=>b.textContent.trim()==='關卡').click()",
    );
    await until("!!document.querySelector('.level-grid')", "Level selector");
    await evaluate(
      `document.querySelector('.level-grid button[aria-label^="第 ${first} 關"]').click()`,
    );
  }
  for (const meta of index) {
    const level = JSON.parse(
      readFileSync(new URL(`../public/levels/${meta.file}`, import.meta.url)),
    );
    const route = solveLevel(level.cars);
    assert.ok(route.solvable);
    await until(
      `document.querySelector('.stage-heading h2')?.textContent==='第 ${String(meta.id).padStart(2, "0")} 關'&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&!document.querySelector('.toolbar button:nth-child(3)')?.disabled`,
      `Level ${meta.id} did not become playable`,
    );
    for (const move of route.moves) {
      const points = await evaluate(
        `(()=>{const a=document.querySelector('.garage-canvas').garageInspection,c=a.snapshot().cars.find(c=>c.id===${JSON.stringify(move.carId)}),[x,,z]=c.position;for(const h of [.55,.8,.35,1])for(const offset of [0,-.2,.2]){const px=x+(c.dir==='H'?offset:0),pz=z+(c.dir==='V'?offset:0),from=a.project(px,h,pz);if(a.pick(from.x,from.y)!==c.id)continue;return {from,to:a.project(px+(c.dir==='H'?${move.delta}:0),h,pz+(c.dir==='V'?${move.delta}:0))};}return null;})()`,
      );
      if (!points) {
        console.log(
          JSON.stringify(
            await evaluate(
              "({heading:document.querySelector('.stage-heading h2').textContent,moves:document.querySelector('.stats b').textContent,snapshot:document.querySelector('.garage-canvas').garageInspection.snapshot()})",
            ),
          ),
        );
        writeFileSync(
          new URL(
            "../docs/upgrade-2026-10-05/failed-drag.png",
            import.meta.url,
          ),
          Buffer.from(
            (await send("Page.captureScreenshot", { format: "png" })).data,
            "base64",
          ),
        );
      }
      assert.ok(points, `Level ${meta.id}: ${move.carId} must be selectable`);
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        ...points.from,
      });
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        ...points.from,
        button: "left",
        clickCount: 1,
      });
      assert.equal(
        await evaluate(
          "document.querySelector('.garage-canvas').dataset.dragging",
        ),
        move.carId,
      );
      // Keep native input ordered at 15 ms intervals without waiting for each
      // event acknowledgement (which can be delayed by software rendering).
      const motionEvents = [];
      for (let step = 1; step <= 4; step++) {
        motionEvents.push(
          send("Input.dispatchMouseEvent", {
            type: "mouseMoved",
            x: points.from.x + ((points.to.x - points.from.x) * step) / 4,
            y: points.from.y + ((points.to.y - points.from.y) * step) / 4,
            button: "left",
            buttons: 1,
          }),
        );
        await sleep(15);
      }
      await Promise.all(motionEvents);
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        ...points.to,
        button: "left",
        clickCount: 1,
      });
      await sleep(85);
    }
    await until(
      "!!document.querySelector('.win-card')",
      `Level ${meta.id} must show win result`,
    );
    const score = await evaluate(
      "Number(document.querySelector('.win-score b').textContent)",
    );
    assert.equal(
      score,
      route.moves.length,
      `Level ${meta.id}: one drag per solver move`,
    );
    const result = { id: meta.id, dragMoves: score, win: true };
    results.push(result);
    console.log(JSON.stringify(result));
    if (meta.id === 1 || meta.id === 40) {
      await sleep(650);
      const name = meta.id === 1 ? "17-win" : "18-final-win";
      writeFileSync(
        new URL(`../docs/upgrade-2026-10-05/${name}.png`, import.meta.url),
        Buffer.from(
          (await send("Page.captureScreenshot", { format: "png" })).data,
          "base64",
        ),
      );
    }
    if (meta.id < limit)
      await evaluate("document.querySelector('.win-next').click()");
  }
  assert.equal(
    await evaluate(
      "Object.values(JSON.parse(localStorage.getItem('traffic-jam-progress-v2'))).filter(r=>r.completed).length",
    ),
    limit,
  );
  writeFileSync(
    new URL(
      `../docs/upgrade-2026-10-05/${first > 1 ? "browser-range-evidence" : limit === 40 ? "browser-level-evidence" : "browser-first-level-evidence"}.json`,
      import.meta.url,
    ),
    JSON.stringify(results, null, 2),
  );
  console.log(
    `Official levels ${first}–${limit} completed using actual mouse drags; fixture progress verified.`,
  );
} finally {
  await evaluate(
    `(()=>{for(const [k,v]of Object.entries(${JSON.stringify(saved)}))v==null?localStorage.removeItem(k):localStorage.setItem(k,v);location.reload()})()`,
  );
  await send("Emulation.clearDeviceMetricsOverride");
  ws.close();
}
