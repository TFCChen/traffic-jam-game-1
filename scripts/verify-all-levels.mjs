// Actual mouse-input replay of all official solutions in an isolated Chrome tab.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { solveLevel } from "../src/gameEngine.js";
import { evidenceDir } from './ci-evidence.mjs';
import { connect } from './cdp-test.mjs';
const {send,evaluate,close,until:poll}=await connect(process.argv[2]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(expression, label) {
  try {await poll(expression);}
  catch(error){throw Error(`${label}: ${error.message}`);}
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
const softwareCI = process.env.GARAGE_BROWSER_CI === '1';
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
    width: softwareCI ? 800 : 1280,
    height: softwareCI ? 600 : 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const previousOrigin = await evaluate("performance.timeOrigin");
  await evaluate(
    `localStorage.setItem('traffic-jam-progress-v2',JSON.stringify(${JSON.stringify(fixtureProgress)}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:60,yaw:-12,theme:'day',quality:${JSON.stringify(softwareCI ? 'saver' : 'standard')},motion:1.2}));location.reload()`,
  );
  await until(
    `performance.timeOrigin!==${previousOrigin}`,
    "New test document",
  );
  if (first > 1) {
    await until(
      "document.querySelector('.game-column')?.getAttribute('aria-busy')==='false'&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready",
      "Initial load",
    );
    await evaluate(
      "[...document.querySelectorAll('.toolbar button')].find(b=>b.textContent.trim()==='關卡').click()",
    );
    await until(`!!document.querySelector('.level-grid button[aria-label^="第 ${first} 關"]')`, "Requested level selector");
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
      `(()=>{const s=document.querySelector('.garage-canvas')?.garageInspection?.snapshot();return document.querySelector('.stage-heading h2')?.textContent==='第 ${String(meta.id).padStart(2, "0")} 關'&&!document.querySelector('.level-transition')&&!document.querySelector('.workspace')?.inert&&document.querySelector('.game-column')?.getAttribute('aria-busy')==='false'&&s?.ready&&s.sceneKey==='${meta.id}-play'&&s.performance.renderedSceneKey===s.sceneKey})()`,
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
            "failed-drag.png",
            evidenceDir,
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
        new URL(`${name}.png`, evidenceDir),
        Buffer.from(
          (await send("Page.captureScreenshot", { format: "png" })).data,
          "base64",
        ),
      );
    }
    await until("document.querySelector('.win-card')?.getAttribute('aria-busy')==='false'&&!document.querySelector('.win-next')?.disabled",`Level ${meta.id}: exit must finish before next action`);
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
      `${first > 1 ? "browser-range-evidence" : limit === 40 ? "browser-level-evidence" : "browser-first-level-evidence"}.json`,
      evidenceDir,
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
  close();
}
