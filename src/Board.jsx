import React, { useEffect, useRef, useState } from "react";
import { GRID, legalMovesForCar } from "./gameEngine.js";

const CELL = 58;
const SCENE_WIDTH = 520;
const SCENE_HEIGHT = 424;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// A stable colour-to-model mapping keeps the same vehicle recognisable in every level.
function vehicleModel(car) {
  if (car.id === "target") return { kind: "racer", name: "跑車" };
  const hex = car.color.replace("#", "");
  const rgb = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = rgb, max = Math.max(...rgb), min = Math.min(...rgb);
  const hue = max === min ? 0 : ((max === r ? (g - b) / (max - min) : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4) * 60 + 360) % 360;
  if (car.len === 3) {
    if (hue < 75) return { kind: "schoolbus", name: "校車" };
    if (hue < 180) return { kind: "camper", name: "露營車" };
    if (hue < 250) return { kind: "coach", name: "城市巴士" };
    return { kind: "delivery", name: "貨運卡車" };
  }
  if (hue < 55) return { kind: "pickup", name: "皮卡" };
  if (hue < 170) return { kind: "jeep", name: "越野車" };
  if (hue < 250) return { kind: "compact", name: "小轎車" };
  return { kind: "taxi", name: "計程車" };
}

export default function Board({ cars, onMove, hint, editor, editorStart, onCellClick, onRemove, won, disabled }) {
  const viewport = useRef(null);
  const planeOrigin = useRef(null);
  const planeX = useRef(null);
  const planeY = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [boardScale, setBoardScale] = useState(1);
  const blockedTimer = useRef(null);
  const motionTimer = useRef(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setBoardScale(Math.min(1, entry.contentRect.width / SCENE_WIDTH)));
    observer.observe(viewport.current);
    return () => { observer.disconnect(); clearTimeout(blockedTimer.current); clearTimeout(motionTimer.current); };
  }, []);

  function showBlocked(id) {
    setBlocked(id);
    clearTimeout(blockedTimer.current);
    blockedTimer.current = setTimeout(() => setBlocked(null), 320);
  }

  // Invert the projected ground plane, rather than its axis-aligned screen bounds.
  // The orthographic camera keeps this mapping affine at every viewport size.
  function boardPoint(event) {
    const origin = planeOrigin.current.getBoundingClientRect();
    const x = planeX.current.getBoundingClientRect();
    const y = planeY.current.getBoundingClientRect();
    const ax = (x.left - origin.left) / (GRID * CELL), ay = (x.top - origin.top) / (GRID * CELL);
    const bx = (y.left - origin.left) / (GRID * CELL), by = (y.top - origin.top) / (GRID * CELL);
    const determinant = ax * by - ay * bx;
    const dx = event.clientX - origin.left, dy = event.clientY - origin.top;
    return { x: (dx * by - dy * bx) / determinant, y: (dy * ax - dx * ay) / determinant };
  }

  function startDrag(event, car) {
    if (editor || won || disabled || (event.pointerType === "mouse" && event.button !== 0) || dragRef.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const legal = legalMovesForCar(cars, car.id);
    if (!legal.length) { showBlocked(car.id); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = boardPoint(event);
    const next = { car, startX: point.x, startY: point.y, legal, pixels: 0, pointerId: event.pointerId, lastTime: event.timeStamp, speed: 0, direction: 1 };
    dragRef.current = next;
    setDrag(next);
  }

  function moveDrag(event) {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const point = boardPoint(event);
    const raw = active.car.dir === "H" ? point.x - active.startX : point.y - active.startY;
    const deltas = active.legal.map(move => move.delta);
    const pixels = clamp(raw, Math.min(0, ...deltas) * CELL, Math.max(0, ...deltas) * CELL);
    const distance = pixels - active.pixels;
    const speed = Math.abs(distance) / Math.max(8, event.timeStamp - active.lastTime) * 1000;
    const next = { ...active, pixels, lastTime: event.timeStamp, speed, direction: distance === 0 ? active.direction : Math.sign(distance) };
    dragRef.current = next;
    setDrag(next);
    clearTimeout(motionTimer.current);
    const pointerId = event.pointerId;
    motionTimer.current = setTimeout(() => {
      if (dragRef.current?.pointerId !== pointerId) return;
      const stopped = { ...dragRef.current, speed: 0 };
      dragRef.current = stopped;
      setDrag(stopped);
    }, 120);
  }

  function endDrag(event, cancel = false) {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const desired = Math.round(active.pixels / CELL);
    const move = active.legal.find(item => item.delta === desired);
    if (!cancel && move) onMove(move);
    dragRef.current = null;
    setDrag(null);
    clearTimeout(motionTimer.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function keyboardMove(event, car) {
    if (editor || won || disabled) return;
    const delta = car.dir === "H" ? { ArrowLeft: -1, ArrowRight: 1 }[event.key] : { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    if (legalMovesForCar(cars, car.id).some(move => move.delta === delta)) onMove({ carId: car.id, delta });
    else showBlocked(car.id);
  }

  function boardClick(event) {
    if (!editor) return;
    const point = boardPoint(event);
    const col = Math.floor(point.x / CELL);
    const row = Math.floor(point.y / CELL);
    if (row >= 0 && row < GRID && col >= 0 && col < GRID) onCellClick({ row, col });
  }

  const deltas = drag?.legal.map(move => move.delta) ?? [];
  const min = Math.min(0, ...deltas), max = Math.max(0, ...deltas);
  return (
    <div ref={viewport} className={`board-viewport ${won ? "is-cleared" : ""}`} style={{ height: SCENE_HEIGHT * boardScale }}>
      <div className="scene-rig" style={{ transform: `scale(${boardScale})` }}>
      <div className="board-frame">
        <span className="platform-front" aria-hidden="true" /><span className="platform-right" aria-hidden="true" />
        <div className="garage-details" aria-hidden="true">
          <span className="fence north" /><span className="fence south" /><span className="fence west" />
          <span className="fence east upper" /><span className="fence east lower" />
          {[14, 132, 250, 372].flatMap((position, index) => [
            <span key={`north-${index}`} className="rail-post" style={{ left: position, top: 6 }} />,
            <span key={`south-${index}`} className="rail-post" style={{ left: position, top: 369 }} />,
            <span key={`west-${index}`} className="rail-post" style={{ left: 6, top: position }} />,
          ])}
          {[14, 112, 210, 372].map((position, index) => <span key={`east-${index}`} className="rail-post" style={{ left: 370, top: position }} />)}
          <span className="gate-bollard upper" /><span className="gate-bollard lower" />
          <span className="garage-plate">P</span>
          <span className="gate-housing"><i /><b /></span>
          <span className="gate-arm" />
        </div>
        <div className="exit-road" aria-hidden="true"><span className="road-arrow">››</span><i className="exit-signal" /></div>
        <div className="exit-label">{won ? "暢通" : "出口"} <span>→</span></div>
        <div className="board" style={{ width: GRID * CELL, height: GRID * CELL }} onClick={boardClick} aria-label={editor ? "關卡編輯棋盤" : "停車場棋盤"}>
          <span ref={planeOrigin} className="plane-probe" aria-hidden="true" style={{ left: 0, top: 0 }} />
          <span ref={planeX} className="plane-probe" aria-hidden="true" style={{ left: GRID * CELL, top: 0 }} />
          <span ref={planeY} className="plane-probe" aria-hidden="true" style={{ left: 0, top: GRID * CELL }} />
          {Array.from({ length: GRID * GRID }, (_, index) => <span key={index} className="cell" aria-hidden="true" style={{ left: (index % GRID) * CELL, top: Math.floor(index / GRID) * CELL, width: CELL, height: CELL }}><i>{String(index + 1).padStart(2, "0")}</i></span>)}
          <span className="drain drain-top" aria-hidden="true" /><span className="drain drain-bottom" aria-hidden="true" />
          {drag && <div className={`drag-lane ${drag.car.dir}`} style={{ left: (drag.car.col + (drag.car.dir === "H" ? min : 0)) * CELL, top: (drag.car.row + (drag.car.dir === "V" ? min : 0)) * CELL, width: (drag.car.dir === "H" ? drag.car.len + max - min : 1) * CELL, height: (drag.car.dir === "V" ? drag.car.len + max - min : 1) * CELL, "--car-color": drag.car.color }} />}
          {editor && editorStart && <span className="editor-start-marker" aria-label="已選取的車輛起點" style={{ left: editorStart.col * CELL + 4, top: editorStart.row * CELL + 4, width: CELL - 8, height: CELL - 8 }} />}
          {cars.map((car, index) => {
            const dragging = drag?.car.id === car.id;
            const hinted = hint?.carId === car.id;
            const escaping = won && car.id === "target";
            const model = vehicleModel(car);
            const fast = dragging && drag.speed > 480;
            const dx = dragging && car.dir === "H" ? drag.pixels : 0;
            const dy = dragging && car.dir === "V" ? drag.pixels : 0;
            return (
              <div key={car.id} role={editor ? undefined : "button"} tabIndex={editor || won ? -1 : 0}
                aria-label={`${car.id === "target" ? "紅色目標" : `車輛 ${index + 1}，`}${model.name}，${car.dir === "H" ? "左右" : "上下"}移動`}
                aria-disabled={editor ? undefined : won || disabled}
                className={`vehicle ${car.dir} model-${model.kind} ${car.len === 3 ? "bus" : ""} ${car.id === "target" ? "target" : ""} ${hinted ? "hinted" : ""} ${dragging ? "dragging" : ""} ${fast ? "fast" : ""} ${dragging && drag.direction < 0 ? "reverse" : ""} ${blocked === car.id ? "blocked" : ""} ${escaping ? "escaping" : ""} ${editor ? "editing" : ""}`}
                style={{ left: car.col * CELL + 4 + dx, top: car.row * CELL + 4 + dy, width: (car.dir === "H" ? car.len : 1) * CELL - 8, height: (car.dir === "V" ? car.len : 1) * CELL - 8, "--car-color": car.color, "--car-length": `${car.len * CELL - 8}px`, "--idle-delay": `${-index * 1.73}s` }}
                onPointerDown={event => startDrag(event, car)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={event => endDrag(event, true)} onLostPointerCapture={event => endDrag(event, true)} onKeyDown={event => keyboardMove(event, car)}>
                <span className="vehicle-skin" aria-hidden="true">
                  <span className="body-wall near" /><span className="body-wall far" /><span className="body-wall nose" /><span className="body-wall tail" />
                  <span className="wheels" />
                  <span className="car-roof"><i className="window front" /><i className="window rear" /><i className="roof-stripe" /></span>
                  <span className="model-detail" /><span className="bumper" />
                  <span className="headlights" /><span className="light-beams" /><span className="tail-lights" />
                  <span className="idle-exhaust"><i /><i /></span>
                  {dragging && drag.speed > 20 && <span className="drive-effects"><i /><i /><i /><b /><b /><b /><b /></span>}
                </span>
                {car.id === "target" && <span className="target-arrow" aria-hidden="true">→</span>}
                {hinted && <span className="hint-arrow" aria-hidden="true">{car.dir === "H" ? (hint.delta > 0 ? "→" : "←") : (hint.delta > 0 ? "↓" : "↑")}</span>}
                {escaping && <span className="exhaust" aria-hidden="true"><i /><i /><i /></span>}
                {editor && <button className="remove" disabled={disabled} onClick={event => { event.stopPropagation(); onRemove(car.id); }} aria-label={`移除 ${car.id}`}>×</button>}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
