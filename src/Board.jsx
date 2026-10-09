import React, { useEffect, useRef, useState } from "react";
import Board2D from "./Board2D.jsx";
import GoalIntro from "./GoalIntro.jsx";
import { vehicleModel } from "./vehicleModels.js";
import {
  SCENE_THEMES,
  completedOfficialLevels,
  availableTheme,
} from "./sceneThemes.js";
import { QUALITY } from "./gamePreferences.js";
import { Icon, Sheet } from "./GameUI.jsx";
import { DEFAULT_VIEW, restoreView } from "./cameraControls.js";

const DEFAULT = {
  ...DEFAULT_VIEW,
  light: -40,
  intensity: 3,
  shadows: true,
  theme: "day",
  quality: "high",
  motion: 1.2,
  zoom: 1,
  panX: 0,
  panY: 0,
  focusX: 0,
  focusZ: 0,
};
function readSettings() {
  try {
    const value = JSON.parse(
      localStorage.getItem("traffic-jam-scene") || "null",
    );
    if (!value) return DEFAULT;
    return {
      ...restoreView(value),
      light: Math.max(
        -180,
        Math.min(
          180,
          Number.isFinite(Number(value.light)) ? Number(value.light) : -40,
        ),
      ),
      intensity: Math.max(0.5, Math.min(5, Number(value.intensity) || 3)),
      shadows: value.shadows !== false,
      theme: value.theme ?? "day",
      quality: QUALITY[value.quality] ? value.quality : "high",
      motion: Number.isFinite(Number(value.motion))
        ? Math.max(0, Math.min(1.5, Number(value.motion)))
        : 1.2,
    };
  } catch {
    return DEFAULT;
  }
}

export default function Board(props) {
  const editorView = useRef(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [fleetOpen, setFleetOpen] = useState(false);
  const picker = useRef(null);
  useEffect(() => {
    if (!replaceOpen && !fleetOpen) return;
    const close = e => { if (e.type==='keydown' ? e.key==='Escape' : !picker.current?.contains(e.target)) { setReplaceOpen(false); setFleetOpen(false); } };
    document.addEventListener('pointerdown',close); document.addEventListener('keydown',close);
    return () => { document.removeEventListener('pointerdown',close); document.removeEventListener('keydown',close); };
  }, [replaceOpen, fleetOpen]);
  const canvas = useRef(null),
    engine = useRef(null),
    latest = useRef(props);
  const [ready, setReady] = useState(false),
    [fallback, setFallback] = useState(false),
    [selected, setSelected] = useState(null),
    [retry, setRetry] = useState(0);
  const [settings, setSettings] = useState(readSettings),
    [open, setOpen] = useState(false);
  useEffect(() => {
    if (props.editor && !editorView.current) {
      editorView.current=settings;
      setSettings({...settings,pitch:85,yaw:0,zoom:window.innerWidth<=700?.9:.72,focusX:0,focusZ:0,panX:0,panY:window.innerWidth<=700?0:-.35});
    } else if (!props.editor && editorView.current) {
      setSettings(editorView.current);editorView.current=null;
    }
    setReplaceOpen(false);
    setFleetOpen(false);
  }, [props.editor]);
  const [feedback, setFeedback] = useState("");
  latest.current = { ...props, disabled: props.disabled || open };
  useEffect(() => {
    props.onSettingsChange?.(open);
    return () => props.onSettingsChange?.(false);
  }, [open, props.onSettingsChange]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 1600);
    return () => clearTimeout(timer);
  }, [feedback]);
  const completed = completedOfficialLevels(props.progress);
  const theme = availableTheme(settings.theme, completed);
  const settingsRef = useRef(settings);
  settingsRef.current = { ...settings, theme };
  useEffect(() => {
    let cancelled = false,
      instance;
    import("./garageScene.js")
      .then(({ createGarageScene }) => {
        if (cancelled) return;
        try {
          instance = createGarageScene(canvas.current, () => latest.current, {
            ready: () => setReady(true),
            error: () => setFallback(true),
            select: setSelected,
            feedback: setFeedback,
            exitComplete: () => latest.current.onExitComplete?.(),
            cameraChange: (view) =>
              setSettings((current) => ({ ...current, ...view })),
          });
          engine.current = instance;
          instance.settings(settingsRef.current);
          canvas.current.garageInspection = {
            project: instance.project,
            pick: instance.pick,
            snapshot: instance.snapshot,
            measure: instance.measure,
            ...(import.meta.env.DEV ? {probeGlass:instance.probeGlass} : {}),
          };
        } catch {
          setFallback(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      engine.current = null;
    };
  }, [retry]);
  useEffect(() => {
    engine.current?.sync();
  }, [
    props.cars,
    props.won,
    props.hint,
    props.editorStart,
    props.editorConflict,
    props.sceneKey,
    props.editor,
  ]);
  useEffect(() => {
    if (open || props.disabled) engine.current?.cancelInput();
  }, [open, props.disabled]);
  useEffect(() => {
    if (props.won && props.exitFinished) engine.current?.finishExit();
  }, [props.won, props.exitFinished]);
  useEffect(() => {
    engine.current?.settings({ ...settings, theme });
    try {
      if (!props.editor) localStorage.setItem("traffic-jam-scene", JSON.stringify(settings));
    } catch {
      /* Session-only settings still work. */
    }
  }, [settings, theme]);
  useEffect(() => {
    if (fallback) {
      setOpen(false);
      engine.current?.dispose();
      engine.current = null;
    }
  }, [fallback]);
  useEffect(()=>{
    if(!fallback||!props.won)return;
    const timer=setTimeout(()=>latest.current.onExitComplete?.(),window.matchMedia('(prefers-reduced-motion: reduce)').matches?120:1800);
    return()=>clearTimeout(timer);
  },[fallback,props.won,props.sceneKey]);
  function change(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }
  if (fallback)
    return (
      <div className="fallback-workspace">
        <p className="scene-fallback" role="status">
          暫時使用 2.5D 車庫，進度與操作保持可用。
          <button
            onClick={() => {
              setReady(false);
              setFallback(false);
              setRetry((n) => n + 1);
            }}
          >
            重試 3D
          </button>
        </p>
        <Board2D {...props} />
        {props.goalIntro && <GoalIntro onComplete={props.onIntroComplete} />}
      </div>
    );
  return (
    <div className={`garage-3d theme-${theme}`}>
      {ready && props.goalIntro && <GoalIntro onComplete={props.onIntroComplete} />}
      <div className="garage-canvas-wrap">
        <canvas
          ref={canvas}
          className="garage-canvas"
          tabIndex={0}
          aria-label="3D 停車場；單指或左鍵移車，右鍵旋轉、Shift 加右鍵平移、滾輪縮放；場外單指旋轉、雙指平移、捏合縮放。選車後可用方向鍵移動。"
        />
        {!ready && (
          <div className="scene-loading" role="status">
            <span className="loading-dot" />
            正在載入玩具車庫…
          </div>
        )}
      </div>
      <div className="scene-options-bar">
        <span role="status" className="keyboard-help">{feedback}</span>
        <div className="scene-tools">
          <button
            aria-expanded={open}
            aria-controls="scene-settings"
            onClick={() => setOpen(!open)}
          >
            <Icon name="settings" />
            車庫設定
          </button>
        </div>
      </div>
      <div className="camera-navigation" role="group" aria-label="視角操作">
        <div className="camera-zoom-tools">
          <button
            disabled={!ready || open || props.disabled || settings.zoom <= 0.65}
            aria-label="縮小場景"
            onClick={() => change("zoom", Math.max(0.65, settings.zoom / 1.2))}
          >
            −
          </button>
          <span aria-label="場景放大倍率">
            {Math.round(settings.zoom * 100)}%
          </span>
          <button
            disabled={!ready || open || props.disabled || settings.zoom >= 4}
            aria-label="放大場景"
            onClick={() => change("zoom", Math.min(4, settings.zoom * 1.2))}
          >
            ＋
          </button>
          <button
            disabled={!ready || open || props.disabled}
            aria-label="重置視角"
            onClick={() => setSettings((s) => ({ ...s, ...DEFAULT_VIEW }))}
          >
            重置
          </button>
        </div>
        <p className="camera-help">
          <span className="camera-help-desktop">
            右鍵旋轉 · Shift＋右鍵／中鍵平移 · 滾輪縮放
          </span>
          <span className="camera-help-touch">
            場外單指旋轉 · 雙指平移／捏合縮放 · 單指移車
          </span>
        </p>
      </div>
      {open && (
        <Sheet label="車庫設定" onClose={() => setOpen(false)}>
          <div className="settings-heading">
            <div>
              <small>你的微縮車庫</small>
              <h2>車庫設定</h2>
            </div>
            <button aria-label="關閉車庫設定" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <h3 className="settings-label">
            場景氣氛 <small>已通關 {completed}/40</small>
          </h3>
          <div className="scene-themes" role="group" aria-label="場景氣氛">
            {SCENE_THEMES.map((item) => (
              <button
                key={item.id}
                disabled={completed < item.required}
                aria-pressed={theme === item.id}
                onClick={() => change("theme", item.id)}
              >
                <i className={`theme-dot ${item.id}`} />
                <span>
                  {item.name}
                  <small>
                    {completed < item.required
                      ? `通關 ${item.required} 關解鎖`
                      : "已解鎖"}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <h3 className="settings-label">畫質與耗電</h3>
          <div className="quality-options" role="group" aria-label="畫質">
            {Object.entries(QUALITY).map(([id, item]) => (
              <button
                key={id}
                aria-pressed={settings.quality === id}
                onClick={() => change("quality", id)}
              >
                {item.name}
                <small>
                  {id === "high"
                    ? "細緻光影與車漆"
                    : id === "saver"
                      ? "減少動態與耗電"
                      : "流暢優先"}
                </small>
              </button>
            ))}
          </div>
          <h3 className="settings-label">視角與光源</h3>
          <div id="scene-settings" className="scene-settings">
            <div className="view-presets">
              <button
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    ...DEFAULT_VIEW,
                  }))
                }
              >
                遊玩視角
              </button>
              <button
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    ...DEFAULT_VIEW,
                    pitch: 45,
                    yaw: -25,
                    quality: "high",
                  }))
                }
              >
                展示視角
              </button>
            </div>
            <label>
              車身動態 <b>{Math.round((settings.motion ?? 1) * 100)}%</b>
              <input
                aria-label="車身動態"
                type="range"
                min="0"
                max="1.5"
                step=".1"
                value={settings.motion ?? 1}
                onChange={(e) => change("motion", Number(e.target.value))}
              />
            </label>
            <label>
              俯視角 <b>{Math.round(settings.pitch)}°</b>
              <input
                aria-label="俯視角"
                type="range"
                min="30"
                max="90"
                value={settings.pitch}
                onChange={(e) => change("pitch", Number(e.target.value))}
              />
            </label>
            <label>
              左右觀察 <b>{Math.round(settings.yaw)}°</b>
              <input
                aria-label="左右觀察"
                type="range"
                min="-180"
                max="180"
                value={settings.yaw}
                onChange={(e) => change("yaw", Number(e.target.value))}
              />
            </label>
            <label>
              光源方向 <b>{settings.light}°</b>
              <input
                aria-label="光源方向"
                type="range"
                min="-180"
                max="180"
                value={settings.light}
                onChange={(e) => change("light", Number(e.target.value))}
              />
            </label>
            <label>
              光源亮度 <b>{settings.intensity.toFixed(1)}</b>
              <input
                aria-label="光源亮度"
                type="range"
                min=".5"
                max="5"
                step=".1"
                value={settings.intensity}
                onChange={(e) => change("intensity", Number(e.target.value))}
              />
            </label>
            <label className="shadow-toggle">
              <input
                type="checkbox"
                checked={settings.shadows && settings.quality !== "saver"}
                disabled={settings.quality === "saver"}
                onChange={(e) => change("shadows", e.target.checked)}
              />
              投影陰影
            </label>
            <button onClick={() => setSettings({ ...DEFAULT })}>
              恢復預設
            </button>
            <p>
              角度越小越接近側視。省電模式關閉投影與裝飾動態，保留移車回饋。設定會保存在這個瀏覽器。
            </p>
          </div>
        </Sheet>
      )}
      {props.editor && props.cars.length > 0 && (
        <div
          className="vehicle-picker"
          ref={picker}
          aria-label={props.editor ? "編輯車輛" : "鍵盤選取車輛"}
        >
          <button className="fleet-toggle" aria-expanded={fleetOpen} aria-controls="placed-car-list" onClick={() => {setFleetOpen(v=>!v);setReplaceOpen(false);}}>
            {selected && props.cars.some(c=>c.id===selected) ? vehicleModel(props.cars.find(c=>c.id===selected)).name : '選取車輛'} <span>· {props.cars.length} 台</span>
          </button>
          {fleetOpen && <div className="placed-car-list" id="placed-car-list">{props.cars.map((car, index) => (
            <button
              key={car.id}
              className={selected === car.id ? "selected" : ""}
              disabled={!ready || props.disabled || props.won}
              style={{ "--car-color": car.color }}
              aria-label={`選取${car.id === "target" ? "紅色目標" : `車輛 ${index + 1}，`}${vehicleModel(car).name}，第${car.row + 1}列第${car.col + 1}格，${car.dir === "H" ? "水平" : "垂直"}${car.len}格`}
              aria-pressed={selected === car.id}
              onClick={() => { setReplaceOpen(false); setFleetOpen(false); engine.current?.select(car.id); }}
            >
              <span
                className={`mini-car ${vehicleModel(car).kind}`}
                aria-hidden="true"
              />
              {index + 1} {vehicleModel(car).name}
            </button>
          ))}</div>}
          {props.editor &&
            selected &&
            props.cars.some((c) => c.id === selected) && (
              <div className="selected-car-actions">
              {selected !== 'target' && <button disabled={props.disabled} aria-expanded={replaceOpen} onClick={() => setReplaceOpen(v=>!v)}>更換車種</button>}
              <button
                className="remove-selected"
                disabled={props.disabled}
                onClick={() => {
                  props.onRemove(selected);
                  setSelected(null);
                }}
              >
                移除選取車輛
              </button>
              {replaceOpen && selected !== 'target' && <div className="vehicle-variants" role="group" aria-label="相同長度的車種">
                {(props.cars.find(c=>c.id===selected).len===3 ? [['城市巴士','#2563eb'],['露營車','#059669'],['校車','#fdd835'],['貨運卡車','#9333ea']] : [['小轎車','#38bdf8'],['越野車','#43a047'],['皮卡','#fb8c00'],['計程車','#ec4899']]).map(([name,color]) =>
                  <button key={color} aria-pressed={props.cars.find(c=>c.id===selected).color===color} onClick={() => { props.onReplace?.(selected,color); setReplaceOpen(false); }}><i style={{background:color}} />{name}</button>)}
              </div>}
              </div>
            )}
        </div>
      )}
      <p className="keyboard-help">
        選車後按方向鍵移動；Escape 取消拖曳。紅車從右側出口離開。
      </p>
    </div>
  );
}
