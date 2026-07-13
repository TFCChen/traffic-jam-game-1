import assert from "node:assert/strict";
import { analyzeDifficulty, applyMove, estimatedDifficultyFromOptimalMoves, legalMovesForCar, solveLevel, starsForPerformance, validateLevel } from "./gameEngine.js";

const level = [
  { id: "target", color: "#e53935", row: 2, col: 0, len: 2, dir: "H" },
  { id: "block", color: "#43a047", row: 1, col: 2, len: 2, dir: "V" },
];

assert.equal(validateLevel(level).valid, true);
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
console.log("gameEngine tests passed");
