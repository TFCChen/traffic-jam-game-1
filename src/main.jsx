import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./experience.css";
import Board from "./Board.jsx";
import LevelBrowser from "./LevelBrowser.jsx";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "./levelCatalog.js";
import OfflineStatus from "./OfflineStatus.jsx";
import { useEditorState } from "./useEditorState.js";
import { mergeBackup } from "./backupState.js";
import { restoreSession } from "./sessionState.js";
import { Icon, Sheet, WinDialog } from "./GameUI.jsx";
import { BADGES, newRewards } from "./gamePreferences.js";
import { completedOfficialLevels } from "./sceneThemes.js";
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
import {
  loadCustomLevels,
  loadProgress,
  saveCustomLevels,
  saveProgress,
  loadDraft,
  saveDraft,
  loadSession,
  saveSession,
  loadTutorial,
  saveTutorial,
  getStorageIssue,
  downloadBackup,
  parseBackup,
  repairStorage,
} from "./storage.js";
import { solveInBackground } from "./solverClient.js";

const COLORS = [
  "#8b5cf6",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#3b82f6",
  "#14b8a6",
  "#84cc16",
  "#f97316",
];
const DEFAULT_LEVEL = {
  id: "demo",
  title: "暫時車庫",
  difficulty: "Beginner",
  file: "level-001.json",
  cars: [
    { id: "target", color: "#e53935", row: 2, col: 0, len: 2, dir: "H" },
    { id: "block", color: "#43a047", row: 1, col: 2, len: 2, dir: "V" },
  ],
};

const levelKey = (level) => String(level.id);

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return response.json();
}

function isPointOccupied(cars, point) {
  return cars.some((car) => {
    if (car.dir === "H") {
      return (
        point.row === car.row &&
        point.col >= car.col &&
        point.col < car.col + car.len
      );
    }
    return (
      point.col === car.col &&
      point.row >= car.row &&
      point.row < car.row + car.len
    );
  });
}

function InstallApp() {
  const [platform, setPlatform] = useState("other");
  const [installed, setInstalled] = useState(false);
  const [guide, setGuide] = useState(false);
  const prompt = useRef(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(
      /iPhone|iPad|iPod/.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
        ? "ios"
        : /Android/i.test(ua)
          ? "android"
          : "desktop",
    );
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true;
    setInstalled(standalone);
    const install = (event) => {
      event.preventDefault();
      prompt.current = event;
    };
    const done = () => {
      setInstalled(true);
      prompt.current = null;
    };
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function openGuide() {
    if (prompt.current) {
      const event = prompt.current;
      prompt.current = null;
      await event.prompt();
      if ((await event.userChoice).outcome === "accepted") setInstalled(true);
      else setGuide(true);
    } else setGuide(true);
  }
  if (installed) return null;
  return (
    <>
      <button className="install-app-button" onClick={openGuide}>
        <Icon name="install" />
        安裝遊戲
      </button>
      {guide && (
        <Sheet label="安裝玩具車庫" onClose={() => setGuide(false)}>
          <div className="install-guide">
            <div className="install-guide-icon">
              <img src="/icon.svg" alt="" />
            </div>
            <small>玩具車庫 · 交通解謎</small>
            <h2>加入主畫面，像 App 一樣遊玩</h2>
            {platform === "ios" ? (
              <ol>
                <li>
                  先在 <b>Safari</b>{" "}
                  開啟朋友傳來的遊戲分享網址，等車庫載入完成。
                </li>
                <li>
                  點底部的<b>分享</b>圖示（方框上箭頭）。
                </li>
                <li>
                  選擇<b>加入主畫面</b>，再點右上角<b>加入</b>。
                </li>
              </ol>
            ) : platform === "android" ? (
              <ol>
                <li>
                  在 <b>Chrome</b> 開啟遊戲網址並等畫面載入完成。
                </li>
                <li>
                  點右上角 <b>⋮</b>，選擇<b>安裝應用程式</b>或<b>加到主畫面</b>
                  。
                </li>
                <li>確認安裝後，就能從主畫面的遊戲圖示啟動。</li>
              </ol>
            ) : (
              <ol>
                <li>使用 Chrome 或 Edge 開啟遊戲網址。</li>
                <li>
                  在網址列的安裝圖示或瀏覽器選單選擇<b>安裝玩具車庫</b>。
                </li>
                <li>安裝後可從桌面或開始功能表啟動。</li>
              </ol>
            )}
            <p>
              安裝免費、不需經過 App
              Store；需要網路開啟分享連結，首次載入完成後，已快取的遊戲也可離線遊玩。
            </p>
            <button className="accent" onClick={() => setGuide(false)}>
              知道了
            </button>
          </div>
        </Sheet>
      )}
    </>
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
  const [panel, setPanel] = useState("none");
  const [garageSettingsOpen, setGarageSettingsOpen] = useState(false);
  const [rewards, setRewards] = useState([]),
    [rewardNotice, setRewardNotice] = useState(false);
  const previousProgress = useRef(progress);
  const winPresented = useRef(false);
  const [winReady, setWinReady] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [hint, setHint] = useState(null);
  const [message, setMessage] = useState("");
  const [initialSession] = useState(loadSession);
  const resume = useRef(initialSession);
  const {
    draft,
    editorTitle,
    setEditorTitle,
    editorCars,
    setEditorCars,
    editingCustomId,
    setEditingCustomId,
    editorStart,
    editorConflict,
    setEditorConflict,
    setEditorStart,
    editorValidation,
    setEditorValidation,
    editorHistory,
    setEditorHistory,
    editorFuture,
    setEditorFuture,
    editorTool,
    setEditorTool,
    editCars,
    undoEditor,
    redoEditor,
  } = useEditorState(mode);
  const [initialized, setInitialized] = useState(false),
    [storageError, setStorageError] = useState(getStorageIssue);
  const [tutorial, setTutorial] = useState(false),
    [tutorialStep, setTutorialStep] = useState(0);
  const [trial, setTrial] = useState(false);
  const importFile = useRef(null),
    officialSolutions = useRef({});
  const solverCache = useRef(new Map());
  const hintCache = useRef(new Map());
  const solverAbort = useRef(null);
  const taskVersion = useRef(0);
  const loadVersion = useRef(0);
  const won = isWon(cars);
  const hasNext = levels.some(
    (level, index) => level.id === current.id && index < levels.length - 1,
  );
  const currentTitle =
    typeof current.id === "number"
      ? initialized
        ? `第 ${String(current.id).padStart(2, "0")} 關`
        : "暫時車庫"
      : current.title;

  useEffect(() => {
    const handler = (e) => setStorageError(e.detail);
    window.addEventListener("garage-storage-error", handler);
    setStorageError(getStorageIssue());
    return () => window.removeEventListener("garage-storage-error", handler);
  }, []);
  useEffect(() => {
    if (!initialized || mode !== "play" || trial || current.id === "editor")
      return;
    saveSession({ levelId: current.id, cars, history, moves });
  }, [initialized, current.id, cars, history, moves, mode, trial]);
  async function importData(event) {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 2_000_000) throw Error("備份檔過大。");
      const data = parseBackup(await file.text());
      const { customLevels: merged, progress: nextProgress } = mergeBackup(
        progress,
        customLevels,
        data,
      );
      setCustomLevels(merged);
      setProgress(nextProgress);
      let savedDraft = true;
      if (data.draft) {
        draft.current = data.draft;
        setEditorCars(data.draft.cars);
        setEditorTitle(data.draft.title);
        setEditingCustomId(null);
        setEditorHistory([]);
        setEditorFuture([]);
        savedDraft = saveDraft({ ...data.draft, id: null });
      }
      const savedCustom = saveCustomLevels(merged),
        savedProgress = saveProgress(nextProgress),
        saved = savedCustom && savedProgress && savedDraft;
      setMessage(
        saved
          ? "備份已合併，既有最佳成績與創作已保留。"
          : "備份已載入本次工作，但尚未保存到裝置。",
      );
    } catch (error) {
      setMessage(`匯入失敗：${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

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

  useEffect(() => {
    const added = newRewards(previousProgress.current, progress);
    previousProgress.current = progress;
    if (!added.length) return;
    setRewards(added);
    setRewardNotice(true);
  }, [progress]);
  useEffect(() => {
    if (!rewardNotice) return;
    const timer = setTimeout(() => setRewardNotice(false), 5500);
    return () => clearTimeout(timer);
  }, [rewardNotice, rewards]);

  useEffect(() => {
    winPresented.current = false;
    setWinReady(false);
    setWinOpen(false);
  }, [won, mode, current.id]);
  useEffect(() => {
    if (
      !won ||
      mode !== "play" ||
      panel !== "none" ||
      garageSettingsOpen ||
      winPresented.current
    )
      return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = setTimeout(
      () => {
        winPresented.current = true;
        setWinReady(true);
        setWinOpen(true);
      },
      reduced ? 120 : 1550,
    );
    return () => clearTimeout(timer);
  }, [won, mode, current.id, panel, garageSettingsOpen]);

  useEffect(() => {
    (async () => {
      try {
        const index = await fetchJson("/levels/index.json");
        const normalized = index.map((item) => ({
          ...item,
          id: Number(item.id),
        }));
        setLevels(normalized);
        try {
          officialSolutions.current = await fetchJson("/levels/solutions.json");
        } catch {
          /* Worker remains available. */
        }
        const saved = resume.current,
          meta =
            normalized.find((v) => v.id === saved?.levelId) ??
            customLevels.find((v) => v.id === saved?.levelId) ??
            normalized[0];
        const source = await loadLevel(meta),
          restored = source ? restoreSession(source, saved) : null;
        if (restored) {
          setCars(cloneCars(restored.cars));
          setHistory(restored.history);
          setMoves(restored.moves);
          setMessage("已接續上次的停車場。");
        }
        setInitialized(Boolean(source));
        if (!loadTutorial() && completedOfficialLevels(progress) === 0)
          setTutorial(true);
      } catch {
        setLevels([]);
        setMessage("無法讀取關卡索引；暫時棋盤不會保存成績，請重新整理。");
        setInitialized(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!won || current.id === "editor" || trial || !initialized) return;
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
          perfect:
            old?.perfect === true || (optimal != null && moves === optimal),
        },
      };
      saveProgress(next);
      return next;
    });
  }, [won, initialized, trial]);

  async function loadLevel(meta) {
    setRewards([]);
    setRewardNotice(false);
    setPanel("none");
    cancelPending();
    const version = loadVersion.current;
    setLoading(true);
    try {
      const raw = meta.cars ? meta : await fetchJson(`/levels/${meta.file}`);
      const valid = validateLevel(raw.cars);
      if (!valid.valid) throw Error(valid.errors[0]);
      if (version !== loadVersion.current) return;
      const level = { ...meta, ...raw, cars: cloneCars(raw.cars) };
      setCurrent(level);
      setInitialized(level.id !== "demo");
      setStartCars(cloneCars(level.cars));
      setCars(cloneCars(level.cars));
      setHistory([]);
      setMoves(0);
      setHint(null);
      setMode("play");
      setMessage("");
      setTrial(false);
      setAnalysis(null);
      if (window.matchMedia("(max-width: 920px)").matches) setPanel("none");
      await analyze(level);
      return level;
    } catch (error) {
      if (version === loadVersion.current)
        setMessage(`無法載入關卡：${error.message}`);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }

  async function analyze(level = current) {
    const key = `${level.id}:${JSON.stringify(level.cars)}`;
    let result = solverCache.current.get(key);
    if (!result) {
      const cached = officialSolutions.current[level.id];
      const solution =
        cached && JSON.stringify(cached.cars) === JSON.stringify(level.cars)
          ? cached.solution
          : await solveForUI(level.cars, "停車場已就緒，正在尋找最佳路線…");
      if (!solution) return;
      const officialDifficulty =
        typeof level.id === "number" && DIFFICULTIES.includes(level.difficulty)
          ? level.difficulty
          : null;
      result = {
        solution,
        ...analyzeDifficulty(level.cars, solution, { officialDifficulty }),
      };
      solverCache.current.set(key, result);
    }
    setAnalysis(result);
    setMessage("");
    return result;
  }

  function commitMove(move) {
    if (won || loading) return;
    if (!legalMovesForCar(cars, move.carId).some((v) => v.delta === move.delta))
      return;
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
    setMoves((count) => Math.max(0, count - 1));
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
    const key = JSON.stringify(cars);
    let solution = hintCache.current.get(key);
    if (!solution && analysis?.solution) {
      let state = startCars;
      for (let i = 0; i < analysis.solution.moves.length; i++) {
        if (JSON.stringify(state) === key) {
          solution = {
            solvable: true,
            moves: analysis.solution.moves.slice(i),
          };
          break;
        }
        state = applyMove(state, analysis.solution.moves[i]);
      }
    }
    if (!solution) solution = await solveForUI(cars, "正在幫你找下一步…");
    if (!solution) return;
    hintCache.current.set(key, solution);
    if (hintCache.current.size > 200)
      hintCache.current.delete(hintCache.current.keys().next().value);
    if (!solution.solvable || !solution.moves.length) {
      setMessage(solution.reason || "目前狀態不需要提示。");
      return;
    }
    setHint(solution.moves[0]);
    const move = solution.moves[0];
    const car = cars.find((item) => item.id === move.carId);
    const direction =
      car.dir === "H"
        ? move.delta > 0
          ? "右"
          : "左"
        : move.delta > 0
          ? "下"
          : "上";
    setMessage(`將發光的車輛往${direction}移動 ${Math.abs(move.delta)} 格。`);
  }

  function nextLevel() {
    setWinOpen(false);
    const index = levels.findIndex((level) => level.id === current.id);
    if (index >= 0 && index < levels.length - 1) loadLevel(levels[index + 1]);
    else setPanel("levels");
  }

  function enterEditor(level = null) {
    cancelPending();
    const savedCustom =
      level && customLevels.find((item) => item.id === level.id);
    setMode("editor");
    setPanel("none");
    if (level || !draft.current) {
      const source = level ?? current;
      setEditorCars(cloneCars(source.cars));
      setEditorTitle(savedCustom?.title ?? "");
      setEditingCustomId(savedCustom?.id ?? null);
      setEditorHistory([]);
      setEditorFuture([]);
    }
    setEditorStart(null);
    setEditorValidation(null);
    setMessage(
      savedCustom
        ? `正在編輯「${savedCustom.title}」。修改後請按「更新關卡」。`
        : "草稿會自動保留。選擇車長與方向，拖拉空白格放車；也可點起點與終點。",
    );
  }

  function cancelEditorStart() {
    setEditorStart(null);
    setMessage("已取消起點選擇。請重新選擇車輛起點。");
  }

  function placeEditorCar(point) {
    const targetExists = editorCars.some((c) => c.id === "target");
    const car = {
      id: targetExists ? `car-${crypto.randomUUID()}` : "target",
      color: targetExists
        ? COLORS[editorCars.length % COLORS.length]
        : "#e53935",
      ...point,
      dir: targetExists ? editorTool.dir : "H",
      len: targetExists ? editorTool.len : 2,
    };
    const validation = validateLevel([...editorCars, car]);
    if (!validation.valid) {
      setEditorConflict(car);
      setMessage(validation.errors[0]);
      return;
    }
    editCars([...editorCars, car]);
    setMessage("車輛已放置；草稿自動保留。");
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
      setMessage(
        `已選起點：第 ${point.row + 1} 列、第 ${point.col + 1} 格。請再點同列或同欄的第 2／3 格。`,
      );
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
      setMessage("終點無效；起點已保留，請選同列或同欄的第 2／3 格。");
      return;
    }

    const targetExists = editorCars.some((car) => car.id === "target");
    const car = {
      id: targetExists ? `car-${Date.now()}` : "target",
      color: targetExists
        ? COLORS[editorCars.length % COLORS.length]
        : "#e53935",
      row: sameRow ? point.row : Math.min(point.row, editorStart.row),
      col: sameRow ? Math.min(point.col, editorStart.col) : point.col,
      len,
      dir: sameRow ? "H" : "V",
    };

    const validation = validateLevel([...editorCars, car]);
    const overlapOnly = validation.errors.filter(
      (error) =>
        !error.includes("必須恰好") && !error.includes("紅色目標車必須"),
    );

    if (overlapOnly.length) {
      setEditorConflict(car);
      setMessage(overlapOnly[0]);
    } else if (
      !targetExists &&
      (car.row !== EXIT_ROW || car.dir !== "H" || car.len !== 2)
    ) {
      setMessage("第一台紅色目標車必須是第 3 列的水平 2 格車。");
    } else {
      editCars([...editorCars, car]);
      setEditorValidation(null);
      setMessage(
        car.id === "target"
          ? "紅車已放置。請繼續選擇其他車輛的起點。"
          : "車輛已放置。請選擇下一台車的起點。",
      );
    }
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
      setMessage(solution.reason || "驗證完成：目前關卡無解。");
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
    setMessage(
      `驗證完成：此關卡有解，最佳 ${solution.moves.length} 步，推估難度 ${difficulty.label}。`,
    );
  }

  async function saveCustom() {
    if (!editingCustomId && customLevels.length >= 200) {
      setMessage("關卡已達 200 關上限，請先匯出備份並整理收藏。");
      return;
    }
    const validation = validateLevel(editorCars);
    if (!validation.valid) {
      setEditorValidation({
        valid: false,
        solvable: false,
        reason: validation.errors[0],
      });
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
      setMessage(solution.reason || "無法儲存無解關卡。");
      return;
    }

    const difficulty = analyzeDifficulty(editorCars, solution);
    const existing = customLevels.find((level) => level.id === editingCustomId);
    const level = existing
      ? {
          ...existing,
          title: editorTitle.trim() || existing.title,
          difficulty: difficulty.label,
          cars: cloneCars(editorCars),
          optimalMoves: solution.moves.length,
        }
      : {
          id: `custom-${Date.now()}`,
          title: editorTitle.trim() || `自製關卡 ${customLevels.length + 1}`,
          difficulty: difficulty.label,
          cars: cloneCars(editorCars),
          optimalMoves: solution.moves.length,
        };
    const next = existing
      ? customLevels.map((item) => (item.id === existing.id ? level : item))
      : [...customLevels, level];

    setCustomLevels(next);
    const persisted = saveCustomLevels(next);
    setEditorTitle(level.title);
    setEditingCustomId(level.id);
    setEditorValidation({
      valid: true,
      solvable: true,
      label: difficulty.label,
      optimalMoves: solution.moves.length,
      blockers: difficulty.blockers,
      explored: difficulty.explored,
    });
    solverCache.current.delete(
      `${level.id}:${JSON.stringify(existing?.cars ?? [])}`,
    );
    setMessage(
      persisted
        ? existing
          ? `「${level.title}」已更新。`
          : `「${level.title}」已儲存在此裝置。`
        : "尚未保存到裝置，請匯出備份。",
    );
  }

  function deleteCustom(level) {
    if (!window.confirm(`確定要刪除「${level.title}」嗎？`)) return;
    const next = customLevels.filter((item) => item.id !== level.id);
    setCustomLevels(next);
    const persisted = saveCustomLevels(next);
    if (editingCustomId === level.id) {
      setEditingCustomId(null);
      setEditorStart(null);
      setEditorValidation(null);
      setMode("play");
    }
    if (current.id === level.id) loadLevel(levels[0] ?? DEFAULT_LEVEL);
    setMessage(
      persisted
        ? `「${level.title}」已刪除。`
        : "本次工作已移除關卡，但裝置存檔尚未更新。",
    );
  }

  function removeEditorCar(id) {
    editCars(editorCars.filter((car) => car.id !== id));
    setEditorStart(null);
    setEditorValidation(null);
  }

  function clearEditor() {
    editCars([]);
    setEditorStart(null);
    setEditorValidation(null);
    setMessage("已清空。請點選紅車的起點。");
  }

  function newCustom() {
    if (
      draft.current?.cars.length &&
      !window.confirm(
        "建立新草稿將取代目前草稿。已儲存的關卡不受影響，確定建立？",
      )
    )
      return;
    enterEditor();
    setEditorCars([]);
    setEditingCustomId(null);
    setEditorTitle("");
    setMessage("先在第 3 列放一台水平 2 格紅車，再加入其他車輛。");
  }

  return (
    <div className="app-shell">
      <div className="ambient-scene" aria-hidden="true">
        <i />
        <i />
        <i />
        <span />
      </div>
      <main className="workspace panel-hidden" inert={winOpen}>
        <section
          className={`game-column ${mode === "editor" ? "editing" : ""}`}
          aria-busy={loading}
        >
          <header className="game-hud">
            <div className="stage-heading">
              <div>
                <span className="stage-kicker">
                  {mode === "editor" ? "BUILD MODE" : "PUZZLE / GARAGE"}
                </span>
                <h2>{mode === "editor" ? "關卡工作台" : currentTitle}</h2>
              </div>
            </div>
            <div className="stats">
              <span>
                <b>{mode === "editor" ? editorCars.length : moves}</b>
                {mode === "editor" ? "車輛" : "步數"}
              </span>
              <span>
                <b>
                  {mode === "editor"
                    ? (editorValidation?.optimalMoves ?? "—")
                    : (analysis?.optimalMoves ?? "—")}
                </b>
                最佳
              </span>
              <span>
                <b>
                  {mode === "editor"
                    ? (DIFFICULTY_LABELS[editorValidation?.label] ?? "待驗證")
                    : (DIFFICULTY_LABELS[
                        analysis?.label ?? current.difficulty
                      ] ?? "自訂")}
                </b>
                難度
              </span>
            </div>
          </header>

          <div
            className={`instruction ${!message && !loading && mode === "play" ? "quiet" : ""} ${loading ? "loading" : ""}`}
            role="status"
            aria-live="polite"
          >
            {loading && <span className="loading-dot" />}
            {message ||
              (loading
                ? "正在準備停車場…"
                : mode === "editor"
                  ? "點起點，再點車尾，放置 2 或 3 格車輛。"
                  : won
                    ? "道路暢通，紅車出發了！"
                    : "沿著車身方向拖曳，放手就會停入格位。")}
          </div>

          <Board
            sceneKey={`${initialized ? current.id : "loading"}-${mode}`}
            cars={mode === "editor" ? editorCars : cars}
            progress={progress}
            onSettingsChange={setGarageSettingsOpen}
            perfect={
              mode === "play" &&
              analysis?.optimalMoves != null &&
              moves <= analysis.optimalMoves
            }
            onMove={commitMove}
            hint={hint}
            won={mode === "play" && won}
            disabled={loading}
            editor={mode === "editor"}
            editorStart={editorStart}
            editorConflict={editorConflict}
            editorTool={editorTool}
            onPlace={placeEditorCar}
            onEditMove={(move) => {
              const next = applyMove(editorCars, move);
              if (
                validateLevel(next).errors.every((error) =>
                  error.includes("必須恰好"),
                )
              )
                editCars(next);
              else setMessage("這個位置與其他車輛衝突。");
            }}
            onCellClick={editorCell}
            onRemove={removeEditorCar}
          />
          <div className="toolbar">
            {mode === "play" ? (
              <>
                <button onClick={undo} disabled={!history.length || loading}>
                  <Icon name="undo" />
                  復原
                </button>
                <button onClick={reset} disabled={loading}>
                  <Icon name="reset" />
                  重來
                </button>
                <button onClick={showHint} disabled={won || loading}>
                  <Icon name="hint" />
                  提示
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  cancelPending();
                  setMode("play");
                  setMessage("草稿已保留，可隨時返回編輯。");
                }}
              >
                <Icon name="undo" />
                返回遊戲
              </button>
            )}
            <button
              className={panel === "levels" ? "selected" : ""}
              onClick={() => setPanel(panel === "levels" ? "none" : "levels")}
              aria-expanded={panel === "levels"}
              aria-controls="game-panels"
            >
              <Icon name="levels" />
              關卡
            </button>
            <button
              className={mode === "editor" ? "selected" : ""}
              onClick={() => enterEditor()}
              disabled={mode === "editor" || loading}
            >
              <Icon name="edit" />
              編輯器
            </button>
          </div>

          {mode === "editor" && (
            <>
              <div className="editor-actions">
                <label>
                  關卡名稱
                  <input
                    maxLength={80}
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="替你的挑戰命名"
                  />
                </label>
                <button
                  onClick={undoEditor}
                  disabled={!editorHistory.length || loading}
                >
                  復原編輯
                </button>
                <button
                  onClick={redoEditor}
                  disabled={!editorFuture.length || loading}
                >
                  重做編輯
                </button>
                <label>
                  方向
                  <select
                    value={editorTool.dir}
                    onChange={(e) =>
                      setEditorTool((t) => ({ ...t, dir: e.target.value }))
                    }
                  >
                    <option value="H">水平</option>
                    <option value="V">垂直</option>
                  </select>
                </label>
                <label>
                  車長
                  <select
                    value={editorTool.len}
                    onChange={(e) =>
                      setEditorTool((t) => ({
                        ...t,
                        len: Number(e.target.value),
                      }))
                    }
                  >
                    <option value={2}>2 格</option>
                    <option value={3}>3 格</option>
                  </select>
                </label>
                {editorStart && (
                  <button onClick={cancelEditorStart}>取消選點</button>
                )}
                <button onClick={clearEditor} disabled={loading}>
                  清空
                </button>
                <button onClick={saveCustom} disabled={loading}>
                  {editingCustomId ? "更新關卡" : "儲存"}
                </button>
                <button
                  className="accent"
                  onClick={validateCustom}
                  disabled={loading}
                >
                  {loading ? "分析中…" : "驗證"}
                </button>
                <button
                  onClick={async () => {
                    if (!validateLevel(editorCars).valid) {
                      setMessage(validateLevel(editorCars).errors[0]);
                      return;
                    }
                    await loadLevel({
                      id: "editor",
                      title: editorTitle || "草稿試玩",
                      difficulty: "Beginner",
                      cars: cloneCars(editorCars),
                    });
                    setTrial(true);
                  }}
                  disabled={loading || !validateLevel(editorCars).valid}
                  title="不必儲存也能試玩"
                >
                  <Icon name="arrow" />
                  試玩
                </button>
              </div>

              {editorValidation && (
                <section
                  className="analysis-card editor-validation"
                  aria-live="polite"
                >
                  <h3>
                    {editorValidation.solvable
                      ? "✓ 關卡有解"
                      : editorValidation.valid
                        ? "關卡無解"
                        : "設定不完整"}
                  </h3>

                  {editorValidation.solvable ? (
                    <dl>
                      <div>
                        <dt>最佳解</dt>
                        <dd>{editorValidation.optimalMoves} 步</dd>
                      </div>
                      <div>
                        <dt>推估難度</dt>
                        <dd>
                          {DIFFICULTY_LABELS[editorValidation.label] ??
                            "尚待判定"}
                        </dd>
                      </div>
                      <div>
                        <dt>主要阻擋車</dt>
                        <dd>{editorValidation.blockers ?? "—"}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p>{editorValidation.reason}</p>
                  )}
                </section>
              )}
            </>
          )}

          {mode === "play" && (
            <div className="board-footer">
              <span className="status-dot" />
              <span>{won ? "道路暢通" : "目標：紅車駛出東側出口"}</span>
              {won && (
                <button
                  onClick={() => {
                    winPresented.current = true;
                    setWinOpen(true);
                  }}
                >
                  查看通關結果 <Icon name="arrow" />
                </button>
              )}
            </div>
          )}
        </section>

        <div className="utility-dock">
          <InstallApp />
          <button
            onClick={() => {
              setTutorialStep(0);
              setTutorial(true);
            }}
          >
            操作指南
          </button>
          {trial && <button onClick={() => enterEditor()}>返回草稿</button>}
          <button
            onClick={() =>
              downloadBackup({ progress, customLevels, draft: draft.current })
            }
          >
            匯出備份
          </button>
          <button onClick={() => importFile.current.click()}>匯入備份</button>
          <input
            ref={importFile}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importData}
          />
        </div>
        {storageError && (
          <div className="storage-alert" role="alert">
            {storageError}
            <button
              onClick={() =>
                downloadBackup({ progress, customLevels, draft: draft.current })
              }
            >
              立即匯出
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "會先保留原始資料備份，再用目前畫面中的進度與關卡修復裝置存檔。建議先匯出備份，確定修復？",
                  )
                )
                  repairStorage({
                    progress,
                    customLevels,
                    draft: draft.current,
                  });
              }}
            >
              修復裝置存檔
            </button>
          </div>
        )}

        {panel !== "none" && (
          <Sheet label="關卡與收藏" onClose={() => setPanel("none")}>
            <aside className="side-panel" id="game-panels">
              <div className="panel-heading">
                <h2>
                  {panel === "collection"
                    ? "我的收藏"
                    : panel === "custom"
                      ? "我的創作"
                      : panel === "analysis"
                        ? "解謎筆記"
                        : "選一個挑戰"}
                </h2>
                <button onClick={() => setPanel("none")} aria-label="收起面板">
                  <Icon name="close" />
                </button>
              </div>
              <div className="tabs">
                <button
                  className={panel === "levels" ? "active" : ""}
                  onClick={() => setPanel("levels")}
                >
                  正式關卡
                </button>
                <button
                  className={panel === "custom" ? "active" : ""}
                  onClick={() => setPanel("custom")}
                >
                  我的關卡
                </button>
                <button
                  className={panel === "analysis" ? "active" : ""}
                  onClick={() => setPanel("analysis")}
                >
                  分析
                </button>
                <button
                  className={panel === "collection" ? "active" : ""}
                  onClick={() => setPanel("collection")}
                >
                  收藏
                </button>
              </div>

              {panel === "levels" && (
                <>
                  <div className="completion-summary">
                    <b>{completedOfficialLevels(progress)} / 40</b>
                    <span>正式關卡已完成</span>
                    <progress
                      value={completedOfficialLevels(progress)}
                      max="40"
                    />
                  </div>
                  <LevelBrowser
                    layouts={officialSolutions.current}
                    levels={levels}
                    current={current}
                    progress={progress}
                    onSelect={(meta) => {
                      setPanel("none");
                      loadLevel(meta);
                    }}
                  />
                </>
              )}
              {panel === "collection" && (
                <div className="badge-collection">
                  {BADGES.map((b, i) => (
                    <div
                      key={b.id}
                      className={b.check(progress) ? "badge earned" : "badge"}
                    >
                      <span className={`medal medal-${i}`} aria-hidden="true">
                        <Icon
                          name={
                            ["garage", "hint", "arrow", "levels", "settings"][i]
                          }
                        />
                      </span>
                      <b>{b.name}</b>
                      <p>{b.description}</p>
                      <small>{b.check(progress) ? "已收藏" : "尚未解鎖"}</small>
                    </div>
                  ))}
                </div>
              )}

              {panel === "custom" && (
                <div className="custom-list">
                  {customLevels.length ? (
                    customLevels.map((level) => (
                      <div
                        className={`custom-item ${editingCustomId === level.id ? "editing" : ""}`}
                        key={level.id}
                      >
                        <button
                          className="custom-play"
                          onClick={() => loadLevel(level)}
                        >
                          <b>{level.title}</b>
                          <span>
                            推估 {DIFFICULTY_LABELS[level.difficulty] ?? "自訂"}{" "}
                            · 最佳 {level.optimalMoves} 步
                          </span>
                        </button>
                        <div
                          className="custom-actions"
                          aria-label={`${level.title} 操作`}
                        >
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
                    <div className="empty-state">
                      <Icon name="garage" />
                      <h3>你的車庫還是空的</h3>
                      <p>把自己的點子變成一個移車挑戰。</p>
                      <button className="accent" onClick={newCustom}>
                        <Icon name="edit" />
                        建立第一關
                      </button>
                    </div>
                  )}
                </div>
              )}

              {panel === "analysis" && (
                <div className="analysis-card">
                  <h3>關卡分析</h3>
                  <dl>
                    <div>
                      <dt>
                        {analysis?.classificationSource === "official"
                          ? "官方難度"
                          : "推估難度"}
                      </dt>
                      <dd>{DIFFICULTY_LABELS[analysis?.label] ?? "待驗證"}</dd>
                    </div>
                    <div>
                      <dt>最佳解</dt>
                      <dd>{analysis?.optimalMoves ?? "—"} 步</dd>
                    </div>
                    <div>
                      <dt>主要阻擋車</dt>
                      <dd>{analysis?.blockers ?? "—"}</dd>
                    </div>
                  </dl>
                  <p>
                    {analysis?.classificationSource === "official"
                      ? "正式關卡沿用實體挑戰卡的原始分級；解題資料只用於最佳步數與提示，不會覆蓋官方難度。"
                      : "自製關卡沒有官方卡片分級，因此依最短解步數推估，僅供參考。"}
                  </p>
                </div>
              )}
            </aside>
          </Sheet>
        )}
      </main>
      <OfflineStatus />
      {tutorial && (
        <Sheet
          label="操作指南"
          onClose={() => {
            setTutorial(false);
            saveTutorial(true);
          }}
        >
          <div className="tutorial-card">
            <small>操作指南 · {tutorialStep + 1} / 4</small>
            <h2>
              {
                [
                  "讓紅車出庫",
                  "沿著車身移動",
                  "先替出口騰出空間",
                  "近看你的車庫",
                ][tutorialStep]
              }
            </h2>
            <p>
              {
                [
                  "紅色跑車是主角，出口位於停車場右側的第三列。",
                  "按住車身前後拖動，放手會停入格位。也可用「選車」後按方向鍵；上下車只能上下移動。",
                  "移開擋路的車，再將紅車送到出口。復原不扣分；卡住時可用提示找到下一步。",
                  "電腦：右鍵拖曳旋轉、Shift＋右鍵或中鍵拖曳平移、滾輪縮放。手機：單指拖曳停車場外的街景旋轉，雙指拖曳平移、捏合縮放；單指抓住車子仍是移車。放大到看不到場外時，先縮小或按「重置」。",
                ][tutorialStep]
              }
            </p>
            <div className="tutorial-illustration" aria-hidden="true">
              <span className="mini-car" />→<span>出口</span>
            </div>
            <button
              onClick={() => {
                setTutorial(false);
                saveTutorial(true);
              }}
            >
              略過／關閉
            </button>
            <button
              className="accent"
              onClick={() => {
                if (tutorialStep < 3) setTutorialStep((s) => s + 1);
                else {
                  setTutorial(false);
                  saveTutorial(true);
                }
              }}
            >
              {tutorialStep < 3 ? "下一步" : "開始移車"}
            </button>
          </div>
        </Sheet>
      )}
      {rewardNotice && (
        <div className="reward-notice" role="status">
          <b>✦ 新收藏</b>
          <span>{rewards.map((r) => r.name).join(" · ")}</span>
          <button
            aria-label="收起解鎖通知"
            onClick={() => setRewardNotice(false)}
          >
            ×
          </button>
        </div>
      )}
      {winOpen && mode === "play" && won && (
        <WinDialog
          moves={moves}
          stars={starsForPerformance(moves, analysis?.optimalMoves)}
          best={analysis?.optimalMoves}
          title={currentTitle}
          rewards={rewards}
          finale={current.id === 40}
          summary={{
            completed: completedOfficialLevels(progress),
            stars: Object.entries(progress)
              .filter(([id]) => /^([1-9]|[1-3]\d|40)$/.test(id))
              .reduce((sum, [, r]) => sum + r.stars, 0),
            perfect: Object.entries(progress).filter(
              ([id, r]) => /^([1-9]|[1-3]\d|40)$/.test(id) && r.perfect,
            ).length,
          }}
          onClose={() => setWinOpen(false)}
          onRetry={reset}
          onNext={nextLevel}
          hasNext={hasNext}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
