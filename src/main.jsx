import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import Board from "./Board.jsx";
import { Icon, Sheet, WinDialog } from "./GameUI.jsx";
import { BADGES, newRewards } from './gamePreferences.js';
import { completedOfficialLevels } from './sceneThemes.js';
import {
  GRID,
  EXIT_ROW,
  analyzeDifficulty,
  applyMove,
  cloneCars,
  isWon,
  legalMovesForCar,
  starsForPerformance,
  validateLevel,
} from "./gameEngine.js";
import { loadCustomLevels, loadProgress, saveCustomLevels, saveProgress } from "./storage.js";
import { solveInBackground } from "./solverClient.js";

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

const levelKey = (level) => String(level.id);
const DIFFICULTY_LABELS = { Beginner: "初級", Intermediate: "中級", Advanced: "進階", Expert: "專家" };

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return response.json();
}

function isPointOccupied(cars, point) {
  return cars.some((car) => {
    if (car.dir === "H") {
      return point.row === car.row && point.col >= car.col && point.col < car.col + car.len;
    }
    return point.col === car.col && point.row >= car.row && point.row < car.row + car.len;
  });
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
          <h3><span>{DIFFICULTY_LABELS[difficulty]}</span><small>{difficulty}</small></h3>
          <div className="level-grid">
            {groups[difficulty].map((level) => {
              const result = progress[levelKey(level)];
              return (
                <button
                  key={level.id}
                  className={current?.id === level.id ? "active" : ""}
                  aria-label={`第 ${level.id} 關${result ? `，已獲得 ${result.stars} 顆星` : ""}`}
                  aria-current={current?.id === level.id ? "true" : undefined}
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
  const [panel, setPanel] = useState('none');
  const [garageSettingsOpen,setGarageSettingsOpen]=useState(false);
  const [rewards,setRewards]=useState([]),[rewardNotice,setRewardNotice]=useState(false);
  const previousProgress=useRef(progress);
  const winPresented=useRef(false);
  const [winReady, setWinReady] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [hint, setHint] = useState(null);
  const [message, setMessage] = useState("");
  const [editorCars, setEditorCars] = useState([]);
  const [editorStart, setEditorStart] = useState(null);
  const [editingCustomId, setEditingCustomId] = useState(null);
  const [editorValidation, setEditorValidation] = useState(null);
  const solverCache = useRef(new Map());
  const solverAbort = useRef(null);
  const taskVersion = useRef(0);
  const loadVersion = useRef(0);
  const won = isWon(cars);
  const hasNext = levels.some((level, index) => level.id === current.id && index < levels.length - 1);
  const currentTitle = typeof current.id === "number" ? `第 ${String(current.id).padStart(2, "0")} 關` : current.title;
  const savedEditorLevel = customLevels.find(level => level.id === editingCustomId);
  const editorHasChanges = savedEditorLevel && JSON.stringify(savedEditorLevel.cars) !== JSON.stringify(editorCars);

  function cancelPending() {
    taskVersion.current += 1;
    loadVersion.current += 1;
    solverAbort.current?.abort();
    setLoading(false);
  }

  async function solveForUI(nextCars, label) {
    const version = ++taskVersion.current;
    solverAbort.current?.abort();
    const controller = new AbortController();
    solverAbort.current = controller;
    setLoading(true);
    setMessage(label);
    try {
      const solution = await solveInBackground(nextCars, controller.signal);
      return version === taskVersion.current ? solution : null;
    } catch (error) {
      if (error.name !== "AbortError") setMessage(error.message);
      return null;
    } finally {
      if (version === taskVersion.current) setLoading(false);
    }
  }

  useEffect(() => () => solverAbort.current?.abort(), []);

  useEffect(()=>{
    const added=newRewards(previousProgress.current,progress);previousProgress.current=progress;
    if(!added.length)return;
    setRewards(added);setRewardNotice(true);
  },[progress]);
  useEffect(()=>{if(!rewardNotice)return;const timer=setTimeout(()=>setRewardNotice(false),5500);return()=>clearTimeout(timer);},[rewardNotice,rewards]);

  useEffect(() => {
    winPresented.current=false;
    setWinReady(false);
    setWinOpen(false);
  },[won,mode,current.id]);
  useEffect(() => {
    if (!won || mode !== "play" || panel!=='none' || garageSettingsOpen || winPresented.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => { winPresented.current=true;setWinReady(true); setWinOpen(true); }, reduced ? 120 : 1550);
    return () => clearTimeout(timer);
  }, [won, mode, current.id,panel,garageSettingsOpen]);

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
          perfect:old?.perfect===true || (optimal!=null && moves===optimal),
        },
      };
      saveProgress(next);
      return next;
    });
  }, [won]);

  async function loadLevel(meta) {
    setRewards([]);
    setRewardNotice(false);
    setPanel('none');
    cancelPending();
    const version = loadVersion.current;
    setLoading(true);
    try {
      const raw = meta.cars ? meta : await fetchJson(`/levels/${meta.file}`);
      if (version !== loadVersion.current) return;
      const level = { ...meta, ...raw, cars: cloneCars(raw.cars) };
      setCurrent(level);
      setStartCars(cloneCars(level.cars));
      setCars(cloneCars(level.cars));
      setHistory([]);
      setMoves(0);
      setHint(null);
      setMode("play");
      setMessage("");
      setEditingCustomId(null);
      setEditorValidation(null);
      setAnalysis(null);
      if (window.matchMedia("(max-width: 920px)").matches) setPanel("none");
      await analyze(level);
    } catch {
      if (version === loadVersion.current) setMessage(`無法載入 ${meta.file}。`);
    } finally { if (version === loadVersion.current) setLoading(false); }
  }

  async function analyze(level = current) {
    const key = `${level.id}:${JSON.stringify(level.cars)}`;
    let result = solverCache.current.get(key);
    if (!result) {
      const solution = await solveForUI(level.cars, "停車場已就緒，正在尋找最佳路線…");
      if (!solution) return;
      const officialDifficulty =
        typeof level.id === "number" && DIFFICULTIES.includes(level.difficulty) ? level.difficulty : null;
      result = { solution, ...analyzeDifficulty(level.cars, solution, { officialDifficulty }) };
      solverCache.current.set(key, result);
    }
    setAnalysis(result);
    setMessage("");
    return result;
  }

  function commitMove(move) {
    if (won || loading) return;
    setHistory((items) => [...items, cloneCars(cars)]);
    setCars((items) => applyMove(items, move));
    setMoves((count) => count + 1);
    setHint(null);
    setMessage("");
  }

  function undo() {
    setRewards([]);
    setHint(null);
    if (!history.length) return;
    setCars(cloneCars(history.at(-1)));
    setHistory(history.slice(0, -1));
    setMoves(count => Math.max(0, count - 1));
    setMessage("");
  }

  function reset() {
    setRewards([]);
    setRewardNotice(false);
    setWinOpen(false);
    setCars(cloneCars(startCars));
    setHistory([]);
    setMoves(0);
    setHint(null);
    setMessage("");
  }

  async function showHint() {
    const solution = await solveForUI(cars, "正在幫你找下一步…");
    if (!solution) return;
    if (!solution.solvable || !solution.moves.length) {
      setMessage(solution.reason || "目前狀態不需要提示。");
      return;
    }
    setHint(solution.moves[0]);
    const move = solution.moves[0];
    const car = cars.find(item => item.id === move.carId);
    const direction = car.dir === "H" ? (move.delta > 0 ? "右" : "左") : (move.delta > 0 ? "下" : "上");
    setMessage(`將發光的車輛往${direction}移動 ${Math.abs(move.delta)} 格。`);
  }

  function nextLevel() {
    setWinOpen(false);
    const index = levels.findIndex((level) => level.id === current.id);
    if (index >= 0 && index < levels.length - 1) loadLevel(levels[index + 1]);
    else setPanel("levels");
  }

  function enterEditor(level = current) {
    cancelPending();
    const savedCustom = customLevels.find((item) => item.id === level.id);
    setMode("editor");
    setPanel("none");
    setEditorCars(cloneCars(level.cars));
    setEditorStart(null);
    setEditingCustomId(savedCustom?.id ?? null);
    setEditorValidation(null);
    setMessage(
      savedCustom
        ? `正在編輯「${savedCustom.title}」。修改後請按「更新關卡」。`
        : "點選起點與終點，建立長度 2 或 3 的車輛。Target 必須位於第 3 列。",
    );
  }

  function cancelEditorStart() {
    setEditorStart(null);
    setMessage("已取消起點選擇。請重新選擇車輛起點。");
  }

  function editorCell(point) {
    if (loading) return;
    if (!editorStart) {
      if (isPointOccupied(editorCars, point)) {
        setMessage("這一格已有車輛，不能作為新車的起點。請選擇空白格。");
        return;
      }
      setEditorValidation(null);
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
      setMessage("終點無效，已取消起點選擇。請重新選擇起點與終點。");
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

    if (overlapOnly.length) {
      setMessage(overlapOnly[0]);
    } else if (!targetExists && (car.row !== EXIT_ROW || car.dir !== "H" || car.len !== 2)) {
      setMessage("第一台 Target 必須是第 3 列的水平 2 格車。");
    } else {
      setEditorCars((items) => [...items, car]);
      setEditorValidation(null);
      setMessage(
        car.id === "target"
          ? "Target 已放置。請繼續選擇其他車輛的起點。"
          : "車輛已放置。請選擇下一台車的起點。",
      );
    }
    setEditorStart(null);
  }

  async function validateCustom() {
    const validation = validateLevel(editorCars);
    if (!validation.valid) {
      setEditorValidation({
        valid: false,
        solvable: false,
        reason: validation.errors[0],
      });
      setMessage(`驗證失敗：${validation.errors[0]}`);
      return;
    }

    const solution = await solveForUI(editorCars, "正在驗證你的停車場…");
    if (!solution) return;
    if (!solution.solvable) {
      setEditorValidation({
        valid: true,
        solvable: false,
        reason: solution.reason || "找不到可行解。",
        explored: solution.explored,
      });
      setMessage("驗證完成：目前關卡無解。");
      return;
    }

    const difficulty = analyzeDifficulty(editorCars, solution);
    setEditorValidation({
      valid: true,
      solvable: true,
      label: difficulty.label,
      optimalMoves: solution.moves.length,
      blockers: difficulty.blockers,
      explored: difficulty.explored,
    });
    setMessage(`驗證完成：此關卡有解，最佳 ${solution.moves.length} 步，推估難度 ${difficulty.label}。`);
  }

  async function saveCustom() {
    const validation = validateLevel(editorCars);
    if (!validation.valid) {
      setEditorValidation({ valid: false, solvable: false, reason: validation.errors[0] });
      setMessage(validation.errors[0]);
      return;
    }

    const solution = await solveForUI(editorCars, "正在確認路線並儲存關卡…");
    if (!solution) return;
    if (!solution.solvable) {
      setEditorValidation({
        valid: true,
        solvable: false,
        reason: solution.reason || "找不到可行解。",
        explored: solution.explored,
      });
      setMessage("無法儲存無解關卡。");
      return;
    }

    const difficulty = analyzeDifficulty(editorCars, solution);
    const existing = customLevels.find((level) => level.id === editingCustomId);
    const level = existing
      ? { ...existing, difficulty: difficulty.label, cars: cloneCars(editorCars), optimalMoves: solution.moves.length }
      : {
          id: `custom-${Date.now()}`,
          title: `自製關卡 ${customLevels.length + 1}`,
          difficulty: difficulty.label,
          cars: cloneCars(editorCars),
          optimalMoves: solution.moves.length,
        };
    const next = existing
      ? customLevels.map((item) => (item.id === existing.id ? level : item))
      : [...customLevels, level];

    setCustomLevels(next);
    saveCustomLevels(next);
    setEditingCustomId(level.id);
    setEditorValidation({
      valid: true,
      solvable: true,
      label: difficulty.label,
      optimalMoves: solution.moves.length,
      blockers: difficulty.blockers,
      explored: difficulty.explored,
    });
    solverCache.current.delete(`${level.id}:${JSON.stringify(existing?.cars ?? [])}`);
    setMessage(existing ? `「${level.title}」已更新。` : `「${level.title}」已儲存在此裝置。`);
  }

  function deleteCustom(level) {
    if (!window.confirm(`確定要刪除「${level.title}」嗎？`)) return;
    const next = customLevels.filter((item) => item.id !== level.id);
    setCustomLevels(next);
    saveCustomLevels(next);
    if (editingCustomId === level.id) {
      setEditingCustomId(null);
      setEditorStart(null);
      setEditorValidation(null);
      setMode("play");
    }
    if (current.id === level.id) loadLevel(levels[0] ?? DEFAULT_LEVEL);
    setMessage(`「${level.title}」已刪除。`);
  }

  function removeEditorCar(id) {
    setEditorCars((items) => items.filter((car) => car.id !== id));
    setEditorStart(null);
    setEditorValidation(null);
  }

  function clearEditor() {
    setEditorCars([]);
    setEditorStart(null);
    setEditorValidation(null);
    setMessage("已清空。請點選 Target 的起點。");
  }

  function newCustom() {
    enterEditor();
    setEditorCars([]);
    setEditingCustomId(null);
    setMessage("先在第 3 列放一台水平 2 格紅車，再加入其他車輛。");
  }

  return (
    <div className="app-shell">
      <div className="ambient-scene" aria-hidden="true"><i /><i /><i /><span /></div>
      <main className="workspace panel-hidden" inert={winOpen}>
        <section className={`game-column ${mode === "editor" ? "editing" : ""}`} aria-busy={loading}>
        <header className="game-hud">
          <div className="stage-heading"><div><span className="stage-kicker">{mode === "editor" ? "BUILD MODE" : "PUZZLE / GARAGE"}</span><h2>{mode === "editor" ? "關卡工作台" : currentTitle}</h2></div></div>
        <div className="stats">
          <span><b>{mode === "editor" ? editorCars.length : moves}</b>{mode === "editor" ? "車輛" : "步數"}</span>
          <span><b>{mode === "editor" ? editorValidation?.optimalMoves ?? "—" : analysis?.optimalMoves ?? "—"}</b>最佳</span>
          <span><b>{mode === "editor" ? DIFFICULTY_LABELS[editorValidation?.label] ?? "待驗證" : DIFFICULTY_LABELS[analysis?.label ?? current.difficulty] ?? "自訂"}</b>難度</span>
        </div>
        </header>


          <div className={`instruction ${!message&&!loading&&mode==='play'?'quiet':''} ${loading ? "loading" : ""}`} role="status" aria-live="polite">{loading && <span className="loading-dot" />}{message || (loading ? "正在準備停車場…" : mode === "editor" ? "點起點，再點車尾，放置 2 或 3 格車輛。" : won ? "道路暢通，紅車出發了！" : "沿著車身方向拖曳，放手就會停入格位。")}</div>

          <Board
            key={`${current.id}-${mode}`}
            cars={mode === "editor" ? editorCars : cars}
            progress={progress}
            onSettingsChange={setGarageSettingsOpen}
            perfect={mode==='play' && analysis?.optimalMoves!=null && moves<=analysis.optimalMoves}
            onMove={commitMove}
            hint={hint}
            won={mode === "play" && won}
            disabled={loading}
            editor={mode === "editor"}
            editorStart={editorStart}
            onCellClick={editorCell}
            onRemove={removeEditorCar}
          />
          <div className="toolbar">
            {mode === "play" ? <>
              <button onClick={undo} disabled={!history.length || loading}><Icon name="undo" />復原</button>
              <button onClick={reset} disabled={loading}><Icon name="reset" />重來</button>
              <button onClick={showHint} disabled={won || loading}><Icon name="hint" />提示</button>
            </> : <button onClick={() => { cancelPending(); setMode("play"); setMessage(""); }}><Icon name="undo" />返回遊戲</button>}
            <button className={panel === "levels" ? "selected" : ""} onClick={() => setPanel(panel === "levels" ? "none" : "levels")} aria-expanded={panel === "levels"} aria-controls="game-panels"><Icon name="levels" />關卡</button>
            <button className={mode === "editor" ? "selected" : ""} onClick={() => enterEditor()} disabled={mode === "editor" || loading}><Icon name="edit" />編輯器</button>
          </div>

          {mode === "editor" && (
            <>
              <div className="editor-actions">
                {editorStart && <button onClick={cancelEditorStart}>取消選點</button>}
                <button onClick={clearEditor} disabled={loading}>清空</button>
                <button onClick={saveCustom} disabled={loading}>{editingCustomId ? "更新關卡" : "儲存"}</button>
                <button className="accent" onClick={validateCustom} disabled={loading}>{loading ? "分析中…" : "驗證"}</button>
                <button onClick={() => loadLevel(savedEditorLevel)} disabled={loading || !savedEditorLevel || editorHasChanges} title="儲存最新變更後即可試玩"><Icon name="arrow" />試玩</button>
              </div>

              {editorValidation && (
                <section className="analysis-card editor-validation" aria-live="polite">
                  <h3>
                    {editorValidation.solvable
                      ? "✓ 關卡有解"
                      : editorValidation.valid
                        ? "關卡無解"
                        : "設定不完整"}
                  </h3>

                  {editorValidation.solvable ? (
                    <dl>
                      <div><dt>最佳解</dt><dd>{editorValidation.optimalMoves} 步</dd></div>
                      <div><dt>推估難度</dt><dd>{editorValidation.label}</dd></div>
                      <div><dt>主要阻擋車</dt><dd>{editorValidation.blockers ?? "—"}</dd></div>
                      <div><dt>搜尋狀態</dt><dd>{editorValidation.explored?.toLocaleString() ?? "—"}</dd></div>
                    </dl>
                  ) : (
                    <p>{editorValidation.reason}</p>
                  )}
                </section>
              )}
            </>
          )}

          {mode === "play" && <div className="board-footer"><span className="status-dot" /><span>{won ? "道路暢通" : "目標：紅車駛出東側出口"}</span>{won && winReady && <button onClick={() => setWinOpen(true)}>查看通關結果 <Icon name="arrow" /></button>}</div>}
        </section>

        {panel !== "none" && <Sheet label="關卡與收藏" onClose={()=>setPanel('none')}><aside className="side-panel" id="game-panels">
          <div className="panel-heading"><h2>{panel === "collection" ? "我的收藏" : panel === "custom" ? "我的創作" : panel === "analysis" ? "解謎筆記" : "選一個挑戰"}</h2><button onClick={() => setPanel("none")} aria-label="收起面板"><Icon name="close" /></button></div>
          <div className="tabs">
            <button className={panel === "levels" ? "active" : ""} onClick={() => setPanel("levels")}>正式關卡</button>
            <button className={panel === "custom" ? "active" : ""} onClick={() => setPanel("custom")}>我的關卡</button>
            <button className={panel === "analysis" ? "active" : ""} onClick={() => setPanel("analysis")}>分析</button>
            <button className={panel === "collection" ? "active" : ""} onClick={() => setPanel("collection")}>收藏</button>
          </div>

          {panel === "levels" && (
            <><div className="completion-summary"><b>{completedOfficialLevels(progress)} / 40</b><span>正式關卡已完成</span><progress value={completedOfficialLevels(progress)} max="40"/></div><LevelBrowser levels={levels} current={current} progress={progress} onSelect={meta=>{setPanel('none');loadLevel(meta);}} /></>
          )}
          {panel==='collection'&&<div className="badge-collection">{BADGES.map(b=><div key={b.id} className={b.check(progress)?'badge earned':'badge'}><span aria-hidden="true">✦</span><b>{b.name}</b><p>{b.description}</p><small>{b.check(progress)?'已收藏':'尚未解鎖'}</small></div>)}</div>}

          {panel === "custom" && (
            <div className="custom-list">
              {customLevels.length ? (
                customLevels.map((level) => (
                  <div className={`custom-item ${editingCustomId === level.id ? "editing" : ""}`} key={level.id}>
                    <button className="custom-play" onClick={() => loadLevel(level)}>
                      <b>{level.title}</b>
                      <span>推估 {level.difficulty} · 最佳 {level.optimalMoves} 步</span>
                    </button>
                    <div className="custom-actions" aria-label={`${level.title} 操作`}>
                      <button
                        className="icon-action"
                        onClick={() => enterEditor(level)}
                        aria-label={`編輯 ${level.title}`}
                        title="編輯"
                      >
                        <span aria-hidden="true">✎</span>
                      </button>
                      <button
                        className="icon-action danger"
                        onClick={() => deleteCustom(level)}
                        aria-label={`刪除 ${level.title}`}
                        title="刪除"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state"><Icon name="garage" /><h3>你的車庫還是空的</h3><p>把自己的點子變成一個移車挑戰。</p><button className="accent" onClick={newCustom}><Icon name="edit" />建立第一關</button></div>
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
        </aside></Sheet>}
      </main>
      {rewardNotice&&<div className="reward-notice" role="status"><b>✦ 新收藏</b><span>{rewards.map(r=>r.name).join(' · ')}</span><button aria-label="收起解鎖通知" onClick={()=>setRewardNotice(false)}>×</button></div>}
      {winOpen && mode === "play" && won && <WinDialog moves={moves} stars={starsForPerformance(moves, analysis?.optimalMoves)} best={analysis?.optimalMoves} title={currentTitle} rewards={rewards} onClose={() => setWinOpen(false)} onRetry={reset} onNext={nextLevel} hasNext={hasNext} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
