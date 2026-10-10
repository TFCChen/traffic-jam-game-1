import { readFileSync, writeFileSync } from "node:fs";
import {
  solveLevel,
  applyMove,
  legalMovesForCar,
  isWon,
} from "../src/gameEngine.js";
const index = JSON.parse(
  readFileSync(new URL("../public/levels/index.json", import.meta.url)),
);
const output = {};
for (const meta of index) {
  const cars = JSON.parse(
      readFileSync(new URL(`../public/levels/${meta.file}`, import.meta.url)),
    ).cars,
    solution = solveLevel(cars);
  if (!solution.solvable) throw Error(`Invalid official level ${meta.id}`);
  let state = cars;
  for (const move of solution.moves) {
    if (
      !legalMovesForCar(state, move.carId).some((m) => m.delta === move.delta)
    )
      throw Error("Invalid route");
    state = applyMove(state, move);
  }
  if (!isWon(state)) throw Error("Route incomplete");
  output[meta.id] = { cars, solution };
}
writeFileSync(
  new URL("../public/levels/solutions.json", import.meta.url),
  JSON.stringify(output),
);
console.log(`Precomputed and replayed ${index.length} official routes.`);
