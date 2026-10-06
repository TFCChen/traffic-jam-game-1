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

export function automaticColor(cars, len) {
  const colors = len === 3 ? ['#2563eb','#059669','#fdd835','#9333ea'] : ['#38bdf8','#43a047','#fb8c00','#ec4899'];
  return colors[cars.filter(c=>c.id!=='target' && c.len===len).length % colors.length];
}

export function placementBetween(cars, start, end) {
  const sameRow=start.row===end.row, sameCol=start.col===end.col;
  const len=sameRow ? Math.abs(end.col-start.col)+1 : sameCol ? Math.abs(end.row-start.row)+1 : 0;
  const dir=sameRow?'H':'V';
  const result=placementAt(cars,{dir,len,color:automaticColor(cars,len)}, {row:Math.min(start.row,end.row),col:Math.min(start.col,end.col)});
  return {...result,len,dir,valid:result.valid && [2,3].includes(len) && (cars.some(c=>c.id==='target') || len===2 && dir==='H')};
}

export function drawingCells(cars, start=null) {
  const points=Array.from({length:GRID*GRID},(_,i)=>({row:Math.floor(i/GRID),col:i%GRID}));
  return points.filter(p=>start ? placementBetween(cars,start,p).valid : points.some(end=>placementBetween(cars,p,end).valid));
}
