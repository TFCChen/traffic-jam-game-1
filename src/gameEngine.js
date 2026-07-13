export const GRID = 6;
export const EXIT_ROW = 2;
export const TARGET_ID = "target";

export const cloneCars = (cars = []) => cars.map((car) => ({ ...car }));

export function cells(car) {
  return Array.from({ length: car.len }, (_, index) => ({
    row: car.row + (car.dir === "V" ? index : 0),
    col: car.col + (car.dir === "H" ? index : 0),
  }));
}

export function isWon(cars) {
  const target = cars.find((car) => car.id === TARGET_ID);
  return Boolean(target && target.row === EXIT_ROW && target.col + target.len >= GRID);
}

export function validateLevel(cars) {
  const errors = [];
  if (!Array.isArray(cars) || cars.length === 0) errors.push("關卡至少需要一台車。");
  const ids = new Set();
  const occupied = new Map();
  let targetCount = 0;

  for (const car of cars || []) {
    if (!car?.id || ids.has(car.id)) errors.push("每台車都需要不重複的 id。");
    ids.add(car?.id);
    if (car?.id === TARGET_ID) targetCount += 1;
    if (![2, 3].includes(car?.len)) errors.push(`${car?.id ?? "車輛"} 長度必須為 2 或 3。`);
    if (!["H", "V"].includes(car?.dir)) errors.push(`${car?.id ?? "車輛"} 方向必須為 H 或 V。`);
    for (const cell of cells(car)) {
      if (cell.row < 0 || cell.row >= GRID || cell.col < 0 || cell.col >= GRID) {
        errors.push(`${car.id} 超出棋盤。`);
        continue;
      }
      const key = `${cell.row}:${cell.col}`;
      if (occupied.has(key)) errors.push(`${car.id} 與 ${occupied.get(key)} 重疊。`);
      occupied.set(key, car.id);
    }
  }

  if (targetCount !== 1) errors.push("關卡必須恰好有一台 target 紅車。");
  const target = (cars || []).find((car) => car.id === TARGET_ID);
  if (target && (target.dir !== "H" || target.row !== EXIT_ROW || target.len !== 2)) {
    errors.push("Target 必須是位於第 3 列、長度 2 的水平車。");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function occupancy(cars, ignoredId = null) {
  const board = Array.from({ length: GRID }, () => Array(GRID).fill(null));
  for (const car of cars) {
    if (car.id === ignoredId) continue;
    for (const cell of cells(car)) {
      if (cell.row >= 0 && cell.row < GRID && cell.col >= 0 && cell.col < GRID) board[cell.row][cell.col] = car.id;
    }
  }
  return board;
}

export function legalMovesForCar(cars, carId) {
  const car = cars.find((item) => item.id === carId);
  if (!car) return [];
  const board = occupancy(cars, carId);
  const moves = [];
  for (const direction of [-1, 1]) {
    for (let distance = 1; distance <= GRID; distance += 1) {
      const next = { ...car };
      if (car.dir === "H") next.col += direction * distance;
      else next.row += direction * distance;
      const nextCells = cells(next);
      const targetExit = car.id === TARGET_ID && car.dir === "H" && direction > 0 && car.row === EXIT_ROW;
      const invalid = nextCells.some(({ row, col }) => {
        if (row < 0 || row >= GRID || col < 0) return true;
        if (col >= GRID) return !targetExit;
        return Boolean(board[row][col]);
      });
      if (invalid) break;
      moves.push({ carId, delta: direction * distance });
      if (targetExit && next.col + next.len >= GRID) break;
    }
  }
  return moves;
}

export function allLegalMoves(cars) {
  return cars.flatMap((car) => legalMovesForCar(cars, car.id));
}

export function applyMove(cars, move) {
  return cars.map((car) => {
    if (car.id !== move.carId) return { ...car };
    return car.dir === "H" ? { ...car, col: car.col + move.delta } : { ...car, row: car.row + move.delta };
  });
}

export function stateKey(cars) {
  return [...cars]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((car) => `${car.id}:${car.row},${car.col}`)
    .join("|");
}

export function solveLevel(cars, { maxStates = 120000 } = {}) {
  const validation = validateLevel(cars);
  if (!validation.valid) return { solvable: false, reason: validation.errors[0], moves: [], explored: 0 };
  if (isWon(cars)) return { solvable: true, moves: [], explored: 1 };

  const start = cloneCars(cars);
  const queue = [{ cars: start, path: [] }];
  const seen = new Set([stateKey(start)]);
  let index = 0;

  while (index < queue.length && seen.size <= maxStates) {
    const current = queue[index++];
    for (const move of allLegalMoves(current.cars)) {
      const nextCars = applyMove(current.cars, move);
      const key = stateKey(nextCars);
      if (seen.has(key)) continue;
      seen.add(key);
      const path = [...current.path, move];
      if (isWon(nextCars)) return { solvable: true, moves: path, explored: seen.size };
      queue.push({ cars: nextCars, path });
    }
  }
  return { solvable: false, reason: seen.size > maxStates ? "搜尋範圍過大。" : "找不到解法。", moves: [], explored: seen.size };
}

export function estimatedDifficultyFromOptimalMoves(optimalMoves) {
  if (!Number.isFinite(optimalMoves)) return "Unsolvable";
  if (optimalMoves <= 10) return "Beginner";
  if (optimalMoves <= 20) return "Intermediate";
  if (optimalMoves <= 30) return "Advanced";
  return "Expert";
}

export function analyzeDifficulty(cars, solution = solveLevel(cars), { officialDifficulty = null } = {}) {
  if (!solution.solvable) {
    return {
      label: "Unsolvable",
      estimatedLabel: "Unsolvable",
      classificationSource: "estimated",
      score: 0,
      optimalMoves: null,
      blockers: 0,
      explored: solution.explored,
    };
  }

  const target = cars.find((car) => car.id === TARGET_ID);
  const blockers = cars.filter((car) => car.id !== TARGET_ID && cells(car).some((cell) => cell.row === EXIT_ROW && cell.col >= target.col + target.len)).length;
  const uniqueCars = new Set(solution.moves.map((move) => move.carId)).size;
  const estimatedLabel = estimatedDifficultyFromOptimalMoves(solution.moves.length);
  const score = solution.moves.length * 3 + uniqueCars * 2 + blockers * 2;

  return {
    label: officialDifficulty || estimatedLabel,
    officialDifficulty: officialDifficulty || null,
    estimatedLabel,
    classificationSource: officialDifficulty ? "official" : "estimated",
    score,
    optimalMoves: solution.moves.length,
    blockers,
    explored: solution.explored,
  };
}

export function starsForPerformance(moves, optimalMoves) {
  if (!Number.isFinite(optimalMoves)) return 1;
  if (moves <= optimalMoves) return 3;
  if (moves <= optimalMoves + Math.max(2, Math.ceil(optimalMoves * 0.25))) return 2;
  return 1;
}
