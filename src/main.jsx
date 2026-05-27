import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const GRID = 6;
const CELL = 56;
const BOARD = GRID * CELL;
const EXIT_ROW = 2;
const EXIT_COL = 8;
const PARTICLES = 10;
const LIFE = 520;
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "Expert"];

const COLORS = {
  red: "#e53935",
  yellow: "#fdd835",
  blue: "#1e88e5",
  green: "#43a047",
  purple: "#8e24aa",
  orange: "#fb8c00",
  sky: "#38bdf8",
  pink: "#ec4899",
  black: "#262626",
  teal: "#059669",
};

const DEFAULT = [
  { id: "target", color: COLORS.red, row: 2, col: 1, len: 2, dir: "H" },
  { id: "yellowBus", color: COLORS.yellow, row: 0, col: 4, len: 3, dir: "V" },
  { id: "blue", color: COLORS.blue, row: 0, col: 1, len: 2, dir: "V" },
  { id: "green", color: COLORS.green, row: 4, col: 0, len: 2, dir: "H" },
  { id: "purple", color: COLORS.purple, row: 4, col: 3, len: 2, dir: "H" },
];

const PALETTE = [
  { key: "target", label: "紅車", color: COLORS.red, len: 2 },
  { key: "car2", label: "2格車", color: COLORS.blue, len: 2 },
  { key: "car2b", label: "2格車", color: COLORS.green, len: 2 },
  { key: "car2c", label: "2格車", color: COLORS.purple, len: 2 },
  { key: "bus3", label: "3格車", color: COLORS.yellow, len: 3 },
  { key: "bus3b", label: "3格車", color: COLORS.pink, len: 3 },
];

const FALLBACK_INDEX = Array.from({ length: 40 }, (_, index) => {
  const id = index + 1;
  const difficulty = id <= 10 ? "Beginner" : id <= 20 ? "Intermediate" : id <= 30 ? "Advanced" : "Expert";
  return { id, difficulty, title: `${difficulty} ${id}`, file: `level-${String(id).padStart(3, "0")}.json` };
});

const clone = (level) => (Array.isArray(level) ? level.map((car) => ({ ...car })) : []);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function normalizeLevel(raw, meta = FALLBACK_INDEX[0]) {
  const cars = Array.isArray(raw?.cars) && raw.cars.length > 0 ? raw.cars : DEFAULT;
  return {
    id: raw?.id ?? meta.id,
    difficulty: raw?.difficulty ?? meta.difficulty ?? "Beginner",
    title: raw?.title ?? meta.title ?? `Level ${meta.id}`,
    file: raw?.file ?? meta.file,
    cars: clone(cars),
  };
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

function exited(car) {
  return car?.id === "target" && car.row === EXIT_ROW && car.col + car.len > GRID;
}

function cells(car) {
  if (!car) return [];
  return Array.from({ length: car.len }, (_, i) => ({
    row: car.row + (car.dir === "V" ? i : 0),
    col: car.col + (car.dir === "H" ? i : 0),
  }));
}

function inside(car) {
  return cells(car).every((c) => c.row >= 0 && c.row < GRID && c.col >= 0 && c.col < GRID);
}

function overlaps(test, cars, allowExit = true) {
  for (const c of cells(test)) {
    if (c.row < 0 || c.row >= GRID) return true;
    if (allowExit && test.id === "target" && test.row === EXIT_ROW && c.col >= GRID) continue;
    if (c.col < 0 || c.col >= GRID) return true;

    for (const car of cars || []) {
      if (!car || car.id === test.id || exited(car)) continue;
      if (cells(car).some((x) => x.row === c.row && x.col === c.col)) return true;
    }
  }
  return false;
}

function limits(car, cars) {
  let min = 0;
  let max = 0;

  for (let d = -1; d >= -GRID; d -= 1) {
    const t = { ...car, row: car.row + (car.dir === "V" ? d : 0), col: car.col + (car.dir === "H" ? d : 0) };
    if (overlaps(t, cars)) break;
    min = d;
  }

  const positiveLimit = car.id === "target" && car.row === EXIT_ROW ? EXIT_COL - car.col : GRID;

  for (let d = 1; d <= positiveLimit; d += 1) {
    const t = { ...car, row: car.row + (car.dir === "V" ? d : 0), col: car.col + (car.dir === "H" ? d : 0) };
    if (overlaps(t, cars)) break;
    max = d;
  }

  return { min, max };
}

function makeParticles(rect, color) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rx = rect.width / 2 + 8;
  const ry = rect.height / 2 + 8;
  const stamp = Date.now();

  return Array.from({ length: PARTICLES }, (_, i) => {
    const angle = (Math.PI * 2 * i) / PARTICLES + Math.random() * 0.2;
    const distance = 14 + Math.random() * 24;
    return {
      id: `${stamp}-${i}-${Math.random().toString(36).slice(2)}`,
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: 2.5 + Math.random() * 4,
      color,
    };
  });
}

function Car({ car, dragging, dragPixels, down, move, up }) {
  if (!car) return null;
  const width = car.dir === "H" ? car.len * CELL - 12 : CELL - 12;
  const height = car.dir === "V" ? car.len * CELL - 12 : CELL - 12;
  const transform = car.dir === "H" ? `translate3d(${dragPixels}px,0,0)` : `translate3d(0,${dragPixels}px,0)`;

  return (
    <button
      type="button"
      tabIndex={-1}
      className="car-button"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{
        left: car.col * CELL + 6,
        top: car.row * CELL + 6,
        width,
        height,
        transform,
        zIndex: dragging || exited(car) ? 30 : 10,
      }}
    >
      <div
        className="car-block"
        style={{
          background: `linear-gradient(145deg,rgba(255,255,255,.95) 0%,${car.color} 13%,${car.color} 48%,rgba(0,0,0,.42) 100%)`,
          boxShadow: dragging
            ? "0 24px 30px rgba(0,0,0,.5), inset 0 7px 10px rgba(255,255,255,.48), inset 0 -13px 18px rgba(0,0,0,.34)"
            : "0 14px 22px rgba(0,0,0,.4), inset 0 6px 9px rgba(255,255,255,.4), inset 0 -11px 16px rgba(0,0,0,.3)",
        }}
      >
        <div className="car-inner" />
      </div>
    </button>
  );
}

function Ghost({ draft }) {
  if (!draft) return null;
  const width = draft.dir === "H" ? draft.len * CELL - 12 : CELL - 12;
  const height = draft.dir === "V" ? draft.len * CELL - 12 : CELL - 12;

  return (
    <div
      className="ghost"
      style={{
        left: draft.col * CELL + 6,
        top: draft.row * CELL + 6,
        width,
        height,
        background: draft.valid ? `${draft.color}88` : "rgba(255,0,0,.35)",
      }}
    />
  );
}

function Wall({ className = "" }) {
  return (
    <div className={`wall ${className}`}>
      <div className="wall-glow" />
      <div className="wall-aura" />
    </div>
  );
}

function Board({ cars, drag, mode, draft, boardMove, boardClick, carDown, dragMove, dragEnd, removeCar }) {
  return (
    <div className="board-shell">
      <div className="board-backplate" />
      <Wall className="wall-left" />
      <Wall className="wall-top" />
      <Wall className="wall-bottom" />
      <Wall className="wall-right-top" />
      <Wall className="wall-right-bottom" />
      <div className="exit-tunnel">→</div>
      <div className="exit-stripe top" />
      <div className="exit-stripe bottom" />

      <div
        className="board"
        onPointerMove={mode === "edit" ? boardMove : undefined}
        onClick={mode === "edit" ? boardClick : undefined}
        style={{ width: BOARD, height: BOARD }}
      >
        {Array.from({ length: GRID * GRID }, (_, i) => (
          <div
            key={i}
            className="grid-cell"
            style={{
              left: (i % GRID) * CELL + 4,
              top: Math.floor(i / GRID) * CELL + 4,
              width: CELL - 8,
              height: CELL - 8,
            }}
          />
        ))}

        <Ghost draft={mode === "edit" ? draft : null} />

        {(cars || []).map((car) => (
          <Car
            key={car.id}
            car={car}
            dragging={drag?.id === car.id}
            dragPixels={drag?.id === car.id ? drag.pixels : 0}
            down={(e) => (mode === "play" ? carDown(e, car) : e.stopPropagation())}
            move={mode === "play" ? dragMove : undefined}
            up={mode === "play" ? dragEnd : undefined}
          />
        ))}

        {mode === "edit" &&
          (cars || []).map((car) => (
            <button
              key={`rm-${car.id}`}
              type="button"
              className="remove-car"
              style={{ left: car.col * CELL + 2, top: car.row * CELL + 2 }}
              onClick={(e) => {
                e.stopPropagation();
                removeCar(car.id);
              }}
            >
              ×
            </button>
          ))}
      </div>
    </div>
  );
}

function Particles({ particles }) {
  return (
    <div className="particle-layer">
      {(particles || []).map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color},0 0 ${p.size * 8}px rgba(255,210,80,.55)`,
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
          }}
        />
      ))}
    </div>
  );
}

function LevelSelector({ levels, currentLevel, onLoad }) {
  const groups = useMemo(() => {
    const grouped = { Beginner: [], Intermediate: [], Advanced: [], Expert: [] };
    (levels || []).forEach((level) => {
      const key = grouped[level.difficulty] ? level.difficulty : "Beginner";
      grouped[key].push(level);
    });
    return grouped;
  }, [levels]);

  return (
    <div className="level-panel">
      {DIFFICULTIES.map((difficulty) => (
        <section key={difficulty} className="level-section">
          <div className="level-title">{difficulty}</div>
          <div className="level-grid">
            {groups[difficulty].map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => onLoad(level.id)}
                className={`level-button ${currentLevel?.id === level.id ? "active" : ""}`}
              >
                {level.id}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function WinModal({ level, moves, onRetry, onNext }) {
  return (
    <div className="win-overlay" role="dialog" aria-modal="true" aria-label="通關完成">
      <div className="win-modal">
        <div className="win-spark">★</div>
        <div className="win-title">通關成功！</div>
        <div className="win-subtitle">
          {level?.id === "custom" ? "自訂關卡完成" : `${level?.difficulty ?? "Level"} ${level?.id ?? ""}`}
        </div>
        <div className="win-stat">Moves：{moves}</div>
        <div className="win-actions">
          <button type="button" className="ui-button" onClick={onRetry}>重來一次</button>
          <button type="button" className="ui-button success" onClick={onNext}>下一關</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [levelIndex, setLevelIndex] = useState(FALLBACK_INDEX);
  const [currentLevel, setCurrentLevel] = useState(() => normalizeLevel({ cars: DEFAULT }, FALLBACK_INDEX[0]));
  const [level, setLevel] = useState(() => clone(DEFAULT));
  const [cars, setCars] = useState(() => clone(DEFAULT));
  const [mode, setMode] = useState("play");
  const [moves, setMoves] = useState(0);
  const [drag, setDrag] = useState(null);
  const [particles, setParticles] = useState([]);
  const [template, setTemplate] = useState(PALETTE[0]);
  const [dir, setDir] = useState("H");
  const [draft, setDraft] = useState(null);
  const [loadMessage, setLoadMessage] = useState("");
  const [levelsOpen, setLevelsOpen] = useState(false);
  const lastParticle = useRef(0);

  const target = cars.find((car) => car?.id === "target");
  const won = Boolean(target && exited(target));

  const loadLevel = async (id, customIndex = levelIndex) => {
    const meta = customIndex.find((item) => item.id === id);
    if (!meta) return;

    try {
      const data = await fetchJson(`/levels/${meta.file}`);
      const normalized = normalizeLevel(data, meta);
      setCurrentLevel(normalized);
      setLevel(clone(normalized.cars));
      setCars(clone(normalized.cars));
      setMoves(0);
      setDrag(null);
      setParticles([]);
      setLoadMessage("");
      setLevelsOpen(false);
    } catch {
      const fallback = normalizeLevel({ cars: DEFAULT }, meta);
      setCurrentLevel(fallback);
      setLevel(clone(DEFAULT));
      setCars(clone(DEFAULT));
      setMoves(0);
      setDrag(null);
      setParticles([]);
      setLoadMessage(`讀不到 ${meta.file}，目前顯示預設關卡。`);
      setLevelsOpen(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const index = await fetchJson("/levels/index.json");
        if (cancelled) return;

        if (Array.isArray(index) && index.length > 0) {
          const sorted = [...index].sort((a, b) => a.id - b.id);
          setLevelIndex(sorted);
          await loadLevel(sorted[0].id, sorted);
          return;
        }
      } catch {
        // Use fallback generated buttons.
      }

      if (!cancelled) {
        setLevelIndex(FALLBACK_INDEX);
        setLoadMessage("讀不到 public/levels/index.json，使用內建關卡按鈕。");
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  function reset(next = level) {
    setCars(clone(next));
    setMoves(0);
    setDrag(null);
    setParticles([]);
    lastParticle.current = 0;
  }

  function goNextLevel() {
    const sorted = [...(levelIndex || FALLBACK_INDEX)].sort((a, b) => a.id - b.id);
    const firstId = sorted[0]?.id ?? 1;

    if (currentLevel?.id === "custom") {
      loadLevel(firstId, sorted);
      return;
    }

    const currentIndex = sorted.findIndex((item) => item.id === currentLevel?.id);
    const nextId = currentIndex >= 0 && currentIndex < sorted.length - 1 ? sorted[currentIndex + 1].id : firstId;
    loadLevel(nextId, sorted);
  }

  function addParticles(el, color, throttle = 0) {
    const now = Date.now();
    if (throttle && now - lastParticle.current < throttle) return;
    lastParticle.current = now;

    const burst = makeParticles(el.getBoundingClientRect(), color);
    setParticles((cur) => [...cur, ...burst]);
    window.setTimeout(() => {
      setParticles((cur) => cur.filter((p) => !burst.some((b) => b.id === p.id)));
    }, LIFE);
  }

  function startDrag(e, car) {
    if (won || !car) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    addParticles(e.currentTarget, car.color);

    const lim = limits(car, cars);
    setDrag({
      id: car.id,
      startX: e.clientX,
      startY: e.clientY,
      startRow: car.row,
      startCol: car.col,
      min: lim.min,
      max: lim.max,
      pixels: 0,
    });
  }

  function moveDrag(e) {
    if (!drag || won) return;
    const car = cars.find((x) => x.id === drag.id);
    if (!car) return;

    addParticles(e.currentTarget, car.color, 75);
    const raw = car.dir === "H" ? e.clientX - drag.startX : e.clientY - drag.startY;
    setDrag((cur) => (cur ? { ...cur, pixels: clamp(raw, drag.min * CELL, drag.max * CELL) } : cur));
  }

  function endDrag() {
    if (!drag) return;

    const delta = clamp(Math.round(drag.pixels / CELL), drag.min, drag.max);

    if (delta !== 0) {
      setCars((cur) =>
        cur.map((car) =>
          car.id === drag.id
            ? {
                ...car,
                row: drag.startRow + (car.dir === "V" ? delta : 0),
                col: drag.startCol + (car.dir === "H" ? delta : 0),
              }
            : car
        )
      );
      setMoves((v) => v + 1);
    }

    setDrag(null);
  }

  function gridPos(e) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      col: Math.floor((e.clientX - r.left) / CELL),
      row: Math.floor((e.clientY - r.top) / CELL),
    };
  }

  function makeDraft(row, col) {
    const d = {
      id: template.key === "target" ? "target" : `${template.key}-${Date.now()}`,
      color: template.color,
      row,
      col,
      len: template.len,
      dir,
    };
    const others = level.filter((car) => car.id !== d.id && !(d.id === "target" && car.id === "target"));
    return { ...d, valid: inside(d) && !overlaps(d, others, false) };
  }

  function editorMove(e) {
    const p = gridPos(e);
    if (p.row < 0 || p.row >= GRID || p.col < 0 || p.col >= GRID) {
      setDraft(null);
      return;
    }
    setDraft(makeDraft(p.row, p.col));
  }

  function place() {
    if (!draft?.valid) return;

    const car = {
      id: draft.id,
      color: draft.color,
      row: draft.row,
      col: draft.col,
      len: draft.len,
      dir: draft.dir,
    };

    setLevel((cur) => [...(car.id === "target" ? cur.filter((x) => x.id !== "target") : cur), car]);
  }

  function enterEditor() {
    setMode("edit");
    setLevelsOpen(false);
    setLevel(clone(cars.filter((car) => !exited(car))));
    setDraft(null);
  }

  function playCustom() {
    if (!level.some((car) => car.id === "target")) return;

    const customLevel = {
      id: "custom",
      difficulty: "Custom",
      title: "Custom",
      file: null,
      cars: clone(level),
    };

    setCurrentLevel(customLevel);
    setMode("play");
    reset(level);
  }

  return (
    <div className="app">
      <Particles particles={particles} />

      <main className="game-layout">
        <div className="top-panel">
          <span className="panel-title">{mode === "edit" ? "自訂關卡" : `${currentLevel.difficulty} ${currentLevel.id}`}</span>
          {mode === "play" && <span className="moves">{moves}</span>}
          {won && <span className="win-badge">通關</span>}

          {mode === "play" ? (
            <>
              <button type="button" onClick={() => reset()} className="ui-button">重置</button>
              <button type="button" onClick={() => setLevelsOpen((open) => !open)} className="ui-button level-toggle">
                {levelsOpen ? "收起關卡" : "選擇關卡"}
              </button>
              <button type="button" onClick={enterEditor} className="ui-button accent">自訂關卡</button>
            </>
          ) : (
            <>
              <button type="button" onClick={playCustom} className="ui-button success">開始測試</button>
              <button type="button" onClick={() => setLevel([])} className="ui-button">清空</button>
              <button type="button" onClick={() => setLevel(clone(currentLevel.cars || DEFAULT))} className="ui-button">載入目前關卡</button>
            </>
          )}
        </div>

        {loadMessage && <div className="load-message">{loadMessage}</div>}

        {mode === "play" && levelsOpen && (
          <LevelSelector levels={levelIndex} currentLevel={currentLevel} onLoad={loadLevel} />
        )}

        {mode === "edit" && (
          <div className="editor-panel">
            {PALETTE.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTemplate(item)}
                className={`palette-button ${template.key === item.key ? "active" : ""}`}
              >
                <span className="palette-dot" style={{ background: item.color }} />
                {item.label}
              </button>
            ))}
            <button type="button" onClick={() => setDir((x) => (x === "H" ? "V" : "H"))} className="ui-button warning">
              方向：{dir === "H" ? "橫向" : "直向"}
            </button>
          </div>
        )}

        <Board
          cars={mode === "edit" ? level : cars}
          drag={drag}
          mode={mode}
          draft={draft}
          boardMove={editorMove}
          boardClick={place}
          carDown={startDrag}
          dragMove={moveDrag}
          dragEnd={endDrag}
          removeCar={(id) => setLevel((cur) => cur.filter((car) => car.id !== id))}
        />
      </main>

      {mode === "play" && won && (
        <WinModal level={currentLevel} moves={moves} onRetry={() => reset()} onNext={goNextLevel} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
