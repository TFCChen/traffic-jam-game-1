import {
  validateLevel,
  stateKey,
  allLegalMoves,
  applyMove,
} from "./gameEngine.js";
export function restoreSession(level, saved) {
  if (
    !saved ||
    saved.levelId !== level.id ||
    saved.history.length !== saved.moves
  )
    return null;
  const layout = (cars) =>
    JSON.stringify(
      cars.map(({ id, color, len, dir }) => ({ id, color, len, dir })),
    );
  const expected = layout(level.cars),
    states = [...saved.history, saved.cars];
  if (states.some((c) => !validateLevel(c).valid || layout(c) !== expected))
    return null;
  if (stateKey(states[0]) !== stateKey(level.cars)) return null;
  for (let i = 1; i < states.length; i++)
    if (
      !allLegalMoves(states[i - 1]).some(
        (m) => stateKey(applyMove(states[i - 1], m)) === stateKey(states[i]),
      )
    )
      return null;
  return saved;
}
