import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  GRID,
  EXIT_ROW,
  analyzeDifficulty,
  applyMove,
  cloneCars,
  isWon,
  legalMovesForCar,
  solveLevel,
  starsForPerformance,
  validateLevel,
} from "./gameEngine.js";
import { loadCustomLevels, loadProgress, saveCustomLevels, saveProgress } from "./storage.js";

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "Expert"];
const CELL = 58;
const COLORS = ["#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#3b82f6", "#14b8a6", "#84cc16", "#f97316"];
const DEFAULT_LEVEL = {
  id: 1,
  difficulty: "Beginner",
  file: "level-001.json",
  cars: [
    { id: "target", color: "#e53935", row: 2, col: 0, len: 2, dir: "H" },
    { id: "block", color: "#43a047", row: 1, col: 2, len: 2, dir: "V" },
  ],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const levelKey = (level) => String(level.id);

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return response.json();
}

function Board({ cars, onMove, highlightedCar, editor, editorStart, onCellClick, onRemove }) {
  const [drag, setDrag] = useState(null);

  function startDrag(event, car) {
    if (editor) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const legal = legalMovesForCar(cars, car.id);
    setDrag({ car, startX: event.clientX, startY: event.clientY, legal, pixels: 0 });
  }

  function moveDrag(event) {
    if (!drag) return;
    const raw = drag.car.dir === "H" ? event.clientX - drag.startX : event.clientY - drag.startY;
    const deltas = drag.legal.map((move) => move.delta);
    const min = Math.min(0, ...deltas) * CELL;
    const max = Math.max(0, ...deltas) * CELL;
    setDrag((current) => ({ ...current, pixels: clamp(raw, min, max) }));
  }

  function endDrag() {
    if (!drag) return;
    const desired = Math.round(drag.pixels / CELL);
    if (desired !== 0) {
      const legal = drag.legal.find((move) => move.delta === desired);
      if (legal) onMove(legal);
    }
    setDrag(null);
  }

  function boardClick(event) {
    if (!editor) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / CELL);
    const row = Math.floor((event.clientY - rect.top) / CELL);
    if (row >= 0 && row < GRID && col >= 0 && col < GRID) onCellClick({ row, col });
  }

  return (
    <div className="board-frame">
      <div className="exit-label">EXIT →</div>
      <div className="board" style={{ width: GRID * CELL, height: GRID * CELL }} onClick={boardClick}>
        {Array.from({ length: GRID * GRID }, (_, index) => (
          <span
            key={index}
            className="cell"
            style={{
              left: (index % GRID) * CELL,
              top: Math.floor(index / GRID) * CELL,
              width: CELL,
              height: CELL,
            }}
          />
        ))}
        {editor && editorStart && (
          <span
            className="editor-start-marker"
            aria-label="已選取的車輛起點"
            style={{
              left: editorStart.col * CELL + 4,
              top: editorStart.row * CELL + 4,
              width: CELL - 8,
              height: CELL - 8,
            }}
          />
        )}
        {cars.map((car) => {
          const dragging = drag?.car.id === car.id;
          const left = car.col * CELL;
          const top = car.row * CELL;
          const width = (car.dir === "H" ? car.len : 1) * CELL - 8;
          const height = (car.dir === "V" ? car.len : 1) * CELL - 8;
          const transform = dragging
            ? car.dir === "H"
              ? `translateX(${drag.pixels}px)`
              : `translateY(${drag.pixels}px)`
            : undefined;

          return (
            <div
              key={car.id}
              className={`vehicle ${car.id === "target" ? "target" : ""} ${highlightedCar === car.id ? "hinted" : ""}`}
              style={{ left: left + 4, top: top + 4, width, height, background: car.color, transform }}
              onPointerDown={(event) => startDrag(event, car)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {car.id === "target" && <span>GO</span>}
              {editor && (
                <button
                  className="remove"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(car.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LevelBrowser({ levels, current, progress, onSelect }) {
  const groups = useMemo(
    () => Object.fromEntries(DIFFICULTIES.map((name) => [name, levels.filter((level) => level.difficulty === name)])),
    [levels],
  );

  return (
    <div className="level-browser">
      {DIFFICULTIES.map((difficulty) => (
        <section key={difficulty}>
          <h3>{difficulty}</h3>
          <div className="level-grid">
            {groups[difficulty].map((level) => {
              const result = progress[levelKey(level)];
              return (
                <button
                  key={level.id}
                  className={current?.id === level.id ? "active" : ""}
                  onClick={() => onSelect(level)}
                >
                  <b>{level.id}</b>
                  <small>{result ? "★".repeat(result.stars) : "—"}</small>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function App() {
  const [levels, setLevels] = useState([]);
  const [current, setCurrent] = useState(DEFAULT_LEVEL);
  const [startCars, setStartCars] = useState(cloneCars(DEFAULT_LEVEL.cars));
  const [cars, setCars] = useState(cloneCars(DEFAULT_LEVEL.cars));
  const [history, setHistory] = useState([]);
  const [moves, setMoves] = useState(0);
  const [progress, setProgress] = useState(loadProgress);
  const [customLevels, setCustomLevels] = useState(loadCustomLevels);
  const [mode, setMode] = useState("play");
  const [panel, setPanel] = useState("levels");
  const [analysis, setAnalysis] = useState(null);
  const [hint, setHint] = useState(null);
  const [message, setMessage] = useState("");
  const [editorCars, setEditorCars] = useState([]);
  const [editorStart, setEditorStart] = useState(null);
  const solverCache = useRef(new Map());
  const won = isWon(cars);

  useEffect(() => {
    (async () => {
      try {
        const index = await fetchJson("/levels/index.json");
        const normalized = index.map((item) => ({ ...item, id: Number(item.id) }));
        setLevels(normalized);
        await loadLevel(normalized[0]);
      } catch {
        setLevels([DEFAULT_LEVEL]);
        setMessage("無法讀取關卡索引，已載入內建示範關卡。");
      }
    })();
  }, []);

  useEffect(() => {
    if (!won || current.id === "editor") return;
    const optimal = analysis?.optimalMoves;
    const stars = starsForPerformance(moves, optimal);
    setProgress((previous) => {
      const key = levelKey(current);
      const old = previous[key];
      const next = {
        ...previous,
        [key]: {
          stars: Math.max(old?.stars || 0, stars),
          bestMoves: Math.min(old?.bestMoves ?? Infinity, moves),
          completed: true,
        },
      };
      saveProgress(next);
      return next;
    });
  }, [won]);

  async function loadLevel(meta) {
    try {
      const raw = meta.cars ? meta : await fetchJson(`/levels/${meta.file}`);
      const level = { ...meta, ...raw, cars: cloneCars(raw.cars) };
      setCurrent(level);
      setStartCars(cloneCars(level.cars));
      setCars(cloneCars(level.cars));
      setHistory([]);
      setMoves(0);
      setHint(null);
      setMode("play");
      setMessage("");
      analyze(level);
    } catch {
      setMessage(`無法載入 ${meta.file}。`);
    }
  }

  function analyze(level = current) {
    const key = `${level.id}:${JSON.stringify(level.cars)}`;
    let result = solverCache.current.get(key);
    if (!result) {
      const solution = solveLevel(level.cars);
      const officialDifficulty =
        typeof level.id === "number" && DIFFICULTIES.includes(level.difficulty) ? level.difficulty : null;
      result = { solution, ...analyzeDifficulty(level.cars, solution, { officialDifficulty }) };
      solverCache.current.set(key, result);
    }
    setAnalysis(result);
    return result;
  }

  function commitMove(move) {
    setHistory((items) => [...items, cloneCars(cars)]);
    setCars((items) => applyMove(items, move));
    setMoves((count) => count + 1);
    setHint(null);
  }

  function undo() {
    setHistory((items) => {
      if (!items.length) return items;
      setCars(cloneCars(items.at(-1)));
      setMoves((count) => Math.max(0, count - 1));
      return items.slice(0, -1);
    });
  }

  function reset() {
    setCars(cloneCars(startCars));
    setHistory([]);
    setMoves(0);
    setHint(null);
  }

  function showHint() {
    const solution = solveLevel(cars);
    if (!solution.solvable || !solution.moves.length) {
      setMessage(solution.reason || "目前狀態不需要提示。");
      return;
    }
    setHint(solution.moves[0]);
    setMessage(`提示：移動 ${solution.moves[0].carId} ${Math.abs(solution.moves[0].delta)} 格。`);
  }

  function nextLevel() {
    const index = levels.findIndex((level) => level.id === current.id);
    if (index >= 0 && index < levels.length - 1) loadLevel(levels[index + 1]);
  }

  function enterEditor() {
    setMode("editor");
    setPanel("editor");
    setEditorCars(cloneCars(current.cars));
    setEditorStart(null);
    setMessage("點選起點與終點，建立長度 2 或 3 的車輛。Target 必須位於第 3 列。");
  }

  function editorCell(point) {
    if (!editorStart) {
      setEditorStart(point);
      setMessage(`已選起點：第 ${point.row + 1} 列、第 ${point.col + 1} 格。請再點同列或同欄的第 2／3 格。`);
      return;
    }

    const sameRow = point.row === editorStart.row;
    const sameCol = point.col === editorStart.col;
    const len = sameRow
      ? Math.abs(point.col - editorStart.col) + 1
      : sameCol
        ? Math.abs(point.row - editorStart.row) + 1
        : 0;

    if (![2, 3].includes(len)) {
      setEditorStart(null);
      setMessage("終點無效：已取消目前起點，請重新選擇車輛起點。");
      return;
    }

    const targetExists = editorCars.some((car) => car.id === "target");
    const car = {
      id: targetExists ? `car-${Date.now()}` : "target",
      color: targetExists ? COLORS[editorCars.length % COLORS.length] : "#e53935",
      row: sameRow ? point.row : Math.min(point.row, editorStart.row),
      col: sameRow ? Math.min(point.col, editorStart.col) : point.col,
      len,
      dir: sameRow ? "H" : "V",
    };

    const validation = validateLevel([...editorCars, car]);
    const overlapOnly = validation.errors.filter(
      (error) => !error.includes("必須恰好") && !error.includes("Target 必須"),
    );

    if (overlapOnly.length) setMessage(overlapOnly[0]);
    else if (!targetExists && (car.row !== EXIT_ROW || car.dir !== "H" || car.len !== 2)) {
      setMessage("第一台 Target 必須是第 3 列的水平 2 格車。");
    } else {
      setEditorCars((items) => [...items, car]);
      setMessage(
        car.id === "target"
          ? "Target 已放置。請繼續選擇其他車輛的起點。"
          : "車輛已放置。請選擇下一台車的起點。",
      );
    }
    setEditorStart(null);
  }

  function validateAndPlay() {
    const validation = validateLevel(editorCars);
    if (!validation.valid) {
      setMessage(validation.errors[0]);
      return;
    }
    const solution = solveLevel(editorCars);
    if (!solution.solvable) {
      setMessage(`關卡無解：${solution.reason}`);
      return;
    }
    const difficulty = analyzeDifficulty(editorCars, solution);
    const custom = {
      id: `custom-${Date.now()}`,
      difficulty: difficulty.label,
      title: "自製關卡",
      cars: cloneCars(editorCars),
      analysis: difficulty,
    };
    setCurrent(custom);
    setStartCars(cloneCars(editorCars));
    setCars(cloneCars(editorCars));
    setHistory([]);
    setMoves(0);
    setAnalysis({ solution, ...difficulty });
    setMode("play");
    setPanel("levels");
    setMessage(`驗證完成：推估 ${difficulty.label}，最佳 ${solution.moves.length} 步。`);
  }

  function saveCustom() {
    const validation = validateLevel(editorCars);
    if (!validation.valid) {
      setMessage(validation.errors[0]);
      return;
    }
    const solution = solveLevel(editorCars);
    if (!solution.solvable) {
      setMessage("無法儲存無解關卡。");
      return;
    }
    const difficulty = analyzeDifficulty(editorCars, solution);
    const level = {
      id: `custom-${Date.now()}`,
      title: `自製關卡 ${customLevels.length + 1}`,
      difficulty: difficulty.label,
      cars: cloneCars(editorCars),
      optimalMoves: solution.moves.length,
    };
    const next = [...customLevels, level];
    setCustomLevels(next);
    saveCustomLevels(next);
    setMessage("自製關卡已儲存在此裝置。");
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">PUZZLE GARAGE</p>
          <h1>Traffic Jam</h1>
          <p>把紅色車輛移到出口。每一次拖曳都算一步。</p>
        </div>
        <div className="stats">
          <span><b>{moves}</b>步數</span>
          <span><b>{analysis?.optimalMoves ?? "—"}</b>最佳</span>
          <span><b>{analysis?.label ?? current.difficulty}</b>難度</span>
        </div>
      </header>

      <main className="workspace">
        <section className="game-column">
          <div className="toolbar">
            <button onClick={undo} disabled={!history.length || mode !== "play"}>復原</button>
            <button onClick={reset} disabled={mode !== "play"}>重置</button>
            <button onClick={showHint} disabled={mode !== "play"}>提示</button>
            <button onClick={() => setPanel(panel === "levels" ? "none" : "levels")}>關卡</button>
            <button className="accent" onClick={enterEditor}>編輯器</button>
          </div>

          {message && <div className="message">{message}</div>}

          <Board
            cars={mode === "editor" ? editorCars : cars}
            onMove={commitMove}
            highlightedCar={hint?.carId}
            editor={mode === "editor"}
            editorStart={editorStart}
            onCellClick={editorCell}
            onRemove={(id) => setEditorCars((items) => items.filter((car) => car.id !== id))}
          />

          {mode === "editor" && (
            <div className="editor-actions">
              <button
                onClick={() => {
                  setEditorCars([]);
                  setEditorStart(null);
                  setMessage("已清空。請點選 Target 的起點。");
                }}
              >
                清空
              </button>
              <button onClick={saveCustom}>儲存</button>
              <button className="accent" onClick={validateAndPlay}>驗證並試玩</button>
            </div>
          )}

          {won && (
            <div className="win-card">
              <h2>道路暢通！</h2>
              <p>{moves} 步完成 · {"★".repeat(starsForPerformance(moves, analysis?.optimalMoves))}</p>
              <div>
                <button onClick={reset}>再玩一次</button>
                <button className="accent" onClick={nextLevel}>下一關</button>
              </div>
            </div>
          )}
        </section>

        <aside className="side-panel">
          <div className="tabs">
            <button className={panel === "levels" ? "active" : ""} onClick={() => setPanel("levels")}>正式關卡</button>
            <button className={panel === "custom" ? "active" : ""} onClick={() => setPanel("custom")}>我的關卡</button>
            <button className={panel === "analysis" ? "active" : ""} onClick={() => setPanel("analysis")}>分析</button>
          </div>

          {panel === "levels" && (
            <LevelBrowser levels={levels} current={current} progress={progress} onSelect={loadLevel} />
          )}

          {panel === "custom" && (
            <div className="custom-list">
              {customLevels.length ? (
                customLevels.map((level) => (
                  <button key={level.id} onClick={() => loadLevel(level)}>
                    <b>{level.title}</b>
                    <span>推估 {level.difficulty} · 最佳 {level.optimalMoves} 步</span>
                  </button>
                ))
              ) : (
                <p>尚未儲存自製關卡。</p>
              )}
            </div>
          )}

          {panel === "analysis" && (
            <div className="analysis-card">
              <h3>關卡分析</h3>
              <dl>
                <div>
                  <dt>{analysis?.classificationSource === "official" ? "官方難度" : "推估難度"}</dt>
                  <dd>{analysis?.label ?? "—"}</dd>
                </div>
                <div><dt>最佳解</dt><dd>{analysis?.optimalMoves ?? "—"} 步</dd></div>
                <div><dt>主要阻擋車</dt><dd>{analysis?.blockers ?? "—"}</dd></div>
                <div><dt>搜尋狀態</dt><dd>{analysis?.explored?.toLocaleString() ?? "—"}</dd></div>
              </dl>
              <p>
                {analysis?.classificationSource === "official"
                  ? "正式關卡沿用實體挑戰卡的原始分級；解題資料只用於最佳步數與提示，不會覆蓋官方難度。"
                  : "自製關卡沒有官方卡片分級，因此依最短解步數推估，僅供參考。"}
              </p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
