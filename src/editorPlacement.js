import { GRID, EXIT_ROW } from './gameEngine.js';

export function placementAt(cars, tool, point) {
  const target = !cars.some(car => car.id === 'target');
  const candidate = { ...point, dir: target ? 'H' : tool.dir, len: target ? 2 : tool.len,
    color: target ? '#e53935' : tool.color ?? '#38bdf8' };
  const cells = Array.from({ length: candidate.len }, (_, i) => ({
    row: candidate.row + (candidate.dir === 'V' ? i : 0),
    col: candidate.col + (candidate.dir === 'H' ? i : 0),
  }));
  const valid = (!target || candidate.row === EXIT_ROW) && cells.every(cell =>
    cell.row >= 0 && cell.row < GRID && cell.col >= 0 && cell.col < GRID && !cars.some(car =>
      car.dir === 'H' ? cell.row === car.row && cell.col >= car.col && cell.col < car.col + car.len
        : cell.col === car.col && cell.row >= car.row && cell.row < car.row + car.len));
  return { ...candidate, valid, cells };
}

export function legalPlacements(cars, tool) {
  return Array.from({ length: GRID * GRID }, (_, i) => placementAt(cars, tool, { row: Math.floor(i / GRID), col: i % GRID })).filter(p => p.valid);
}
