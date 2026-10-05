import assert from "node:assert/strict";
import {
  loadProgress,
  saveProgress,
  loadCustomLevels,
  saveCustomLevels,
  loadDraft,
  saveDraft,
  loadSession,
  saveSession,
  parseBackup,
  exportBackup,
  repairStorage,
} from "./storage.js";
import { restoreSession } from "./sessionState.js";
import { mergeBackup } from "./backupState.js";
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, v),
  removeItem: (k) => values.delete(k),
};
const cars = [
  { id: "target", row: 2, col: 0, len: 2, dir: "H", color: "#e53935" },
];
values.set("traffic-jam-custom-levels-v2", "{}");
assert.deepEqual(loadCustomLevels(), []);
values.set("traffic-jam-progress-v2", '{"1":null}');
assert.deepEqual(loadProgress(), {});
const progress = {
  1: { completed: true, stars: 3, bestMoves: 1, perfect: true },
};
assert.equal(saveProgress(progress), false);
assert.equal(values.get("traffic-jam-progress-v2"), '{"1":null}');
assert.ok(repairStorage({ progress, customLevels: [] }));
assert.deepEqual(loadProgress(), progress);
const customLevels = [{ id: "custom-test", title: "原始草稿", cars }];
assert.ok(saveCustomLevels(customLevels));
assert.deepEqual(loadCustomLevels(), customLevels);
assert.ok(saveDraft({ cars: [], title: "空草稿", id: null }));
assert.deepEqual(loadDraft().cars, []);
values.set("traffic-jam-draft-v1", "{broken");
assert.equal(loadDraft(), null);
assert.ok(repairStorage({ progress, customLevels }));
assert.equal(loadDraft(), null);
assert.equal(values.has("traffic-jam-draft-v1"), false);
assert.ok(
  saveDraft({
    cars: [{ ...cars[0], id: "block" }],
    title: "不完整草稿",
    id: null,
  }),
);
assert.equal(loadDraft().cars.length, 1);
assert.ok(saveSession({ levelId: 1, cars, history: [], moves: 0 }));
assert.equal(loadSession().levelId, 1);
assert.ok(restoreSession({ id: 1, cars }, loadSession()));
assert.equal(
  restoreSession(
    { id: 1, cars },
    { levelId: 1, cars: [{ ...cars[0], col: 2 }], history: [], moves: 0 },
  ),
  null,
);
assert.deepEqual(
  parseBackup(exportBackup({ progress, customLevels })).customLevels,
  customLevels,
);
const collision = mergeBackup(
  { "custom-test": { completed: true, stars: 3, bestMoves: 2 } },
  customLevels,
  {
    customLevels: [{ ...customLevels[0], title: "不同關卡" }],
    progress: { "custom-test": { completed: true, stars: 1, bestMoves: 8 } },
  },
  () => "custom-copy",
);
assert.equal(collision.customLevels.length, 2);
assert.equal(collision.progress["custom-test"].bestMoves, 2);
assert.equal(collision.progress["custom-copy"].bestMoves, 8);
assert.throws(()=>parseBackup(exportBackup({progress,customLevels:[{...customLevels[0],id:'custom-bad id'}]})));
assert.throws(() =>
  parseBackup(
    exportBackup({
      progress,
      customLevels: [{ ...customLevels[0], cars: [{ ...cars[0], row: 0.5 }] }],
    }),
  ),
);
localStorage.setItem = () => {
  throw new DOMException("Full", "QuotaExceededError");
};
assert.equal(saveProgress(progress), false);
assert.deepEqual(loadProgress(), progress);
console.log(
  "Storage schema, legacy migration, draft/session, backup rejection and quota preservation passed.",
);
