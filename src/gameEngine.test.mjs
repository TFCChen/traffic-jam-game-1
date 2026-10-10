import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeDifficulty, applyMove, estimatedDifficultyFromOptimalMoves, isWon, legalMovesForCar, solveLevel, starsForPerformance, validateLevel } from "./gameEngine.js";

const level = [
  { id: "target", color: "#e53935", row: 2, col: 0, len: 2, dir: "H" },
  { id: "block", color: "#43a047", row: 1, col: 2, len: 2, dir: "V" },
];

assert.equal(validateLevel(level).valid, true);
for(const value of [{},null,[null],[{}],[{...level[0],row:.5}],[{...level[0],row:NaN}],[{...level[0],color:'red'}]])assert.equal(validateLevel(value).valid,false);
assert.equal(solveLevel(level,{maxStates:1}).status,'limit');
assert.equal(legalMovesForCar(level, "block").some((move) => move.delta === 2), true);
const moved = applyMove(level, { carId: "block", delta: 2 });
assert.equal(moved.find((car) => car.id === "block").row, 3);
const solved = solveLevel(level);
assert.equal(solved.solvable, true);
assert.equal(solved.moves.length, 2);
assert.equal(analyzeDifficulty(level, solved).optimalMoves, 2);
assert.equal(analyzeDifficulty(level, solved).label, "Beginner");
assert.equal(analyzeDifficulty(level, solved, { officialDifficulty: "Expert" }).label, "Expert");
assert.equal(analyzeDifficulty(level, solved, { officialDifficulty: "Expert" }).classificationSource, "official");
assert.equal(estimatedDifficultyFromOptimalMoves(21), "Advanced");
assert.equal(starsForPerformance(2, 2), 3);
assert.equal(starsForPerformance(4, 2), 2);
assert.equal(legalMovesForCar(level, "target").some(move => move.delta > 0), false, "Cannot cross a blocking car");
assert.equal(validateLevel([...level, { ...level[1], id: "overlap" }]).valid, false);
assert.equal(validateLevel([{ ...level[0], row: 1 }]).valid, false);
let replay = level;
for (const move of solved.moves) {
  assert.ok(legalMovesForCar(replay, move.carId).some(legal => legal.delta === move.delta));
  replay = applyMove(replay, move);
}
assert.equal(isWon(replay), true, "Solver path must complete the level");
const index = JSON.parse(readFileSync(new URL("../public/levels/index.json", import.meta.url)));
assert.equal(index.length, 40);
assert.equal(new Set(index.map(meta => meta.id)).size, index.length);
for (const meta of index) {
  const raw = JSON.parse(readFileSync(new URL(`../public/levels/${meta.file}`, import.meta.url)));
  assert.equal(raw.id, meta.id);
  assert.equal(raw.difficulty, meta.difficulty);
  assert.equal(validateLevel(raw.cars).valid, true, `Level ${meta.id} must be valid`);
}
console.log("gameEngine tests passed");
