import React, { useEffect, useRef, useState } from "react";
import { GRID, legalMovesForCar } from "./gameEngine.js";

const CELL = 58;
const FRAME_SIZE = GRID * CELL + 38;
const SCENE_WIDTH = FRAME_SIZE + 92;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function Board({ cars, onMove, hint, editor, editorStart, onCellClick, onRemove, won, disabled }) {
  const viewport = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [boardScale, setBoardScale] = useState(1);
  const blockedTimer = useRef(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setBoardScale(Math.min(1, entry.contentRect.width / SCENE_WIDTH)));
    observer.observe(viewport.current);
    return () => { observer.disconnect(); clearTimeout(blockedTimer.current); };
  }, []);

  function showBlocked(id) {
    setBlocked(id);
    clearTimeout(blockedTimer.current);
    blockedTimer.current = setTimeout(() => setBlocked(null), 320);
  }

  function startDrag(event, car) {
    if (editor || won || disabled || (event.pointerType === "mouse" && event.button !== 0) || dragRef.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const legal = legalMovesForCar(cars, car.id);
    if (!legal.length) { showBlocked(car.id); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    const scale = event.currentTarget.closest(".board").getBoundingClientRect().width / (GRID * CELL);
    const next = { car, startX: event.clientX, startY: event.clientY, legal, pixels: 0, scale, pointerId: event.pointerId };
    dragRef.current = next;
    setDrag(next);
  }

  function moveDrag(event) {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const raw = (active.car.dir === "H" ? event.clientX - active.startX : event.clientY - active.startY) / active.scale;
    const deltas = active.legal.map(move => move.delta);
    const pixels = clamp(raw, Math.min(0, ...deltas) * CELL, Math.max(0, ...deltas) * CELL);
    const next = { ...active, pixels };
    dragRef.current = next;
    setDrag(next);
  }

  function endDrag(event, cancel = false) {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const desired = Math.round(active.pixels / CELL);
    const move = active.legal.find(item => item.delta === desired);
    if (!cancel && move) onMove(move);
    dragRef.current = null;
    setDrag(null);
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
    const rect = event.currentTarget.getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / (rect.width / GRID));
    const row = Math.floor((event.clientY - rect.top) / (rect.height / GRID));
    if (row >= 0 && row < GRID && col >= 0 && col < GRID) onCellClick({ row, col });
  }

  const deltas = drag?.legal.map(move => move.delta) ?? [];
  const min = Math.min(0, ...deltas), max = Math.max(0, ...deltas);
  return (
    <div ref={viewport} className={`board-viewport ${won ? "is-cleared" : ""}`} style={{ height: FRAME_SIZE * boardScale }}>
      <div className="board-frame" style={{ transform: `scale(${boardScale})` }}>
        <div className="exit-road" aria-hidden="true"><span className="road-arrow">››</span><i className="exit-signal" /></div>
        <div className="exit-label">{won ? "暢通" : "出口"} <span>→</span></div>
        <div className="board" style={{ width: GRID * CELL, height: GRID * CELL }} onClick={boardClick} aria-label={editor ? "關卡編輯棋盤" : "停車場棋盤"}>
          {Array.from({ length: GRID * GRID }, (_, index) => <span key={index} className="cell" style={{ left: (index % GRID) * CELL, top: Math.floor(index / GRID) * CELL, width: CELL, height: CELL }} />)}
          {drag && <div className={`drag-lane ${drag.car.dir}`} style={{ left: (drag.car.col + (drag.car.dir === "H" ? min : 0)) * CELL, top: (drag.car.row + (drag.car.dir === "V" ? min : 0)) * CELL, width: (drag.car.dir === "H" ? drag.car.len + max - min : 1) * CELL, height: (drag.car.dir === "V" ? drag.car.len + max - min : 1) * CELL, "--car-color": drag.car.color }} />}
          {editor && editorStart && <span className="editor-start-marker" aria-label="已選取的車輛起點" style={{ left: editorStart.col * CELL + 4, top: editorStart.row * CELL + 4, width: CELL - 8, height: CELL - 8 }} />}
          {cars.map((car, index) => {
            const dragging = drag?.car.id === car.id;
            const hinted = hint?.carId === car.id;
            const escaping = won && car.id === "target";
            const dx = dragging && car.dir === "H" ? drag.pixels : 0;
            const dy = dragging && car.dir === "V" ? drag.pixels : 0;
            return (
              <div key={car.id} role={editor ? undefined : "button"} tabIndex={editor || won ? -1 : 0}
                aria-label={`${car.id === "target" ? "紅色目標車" : `車輛 ${index + 1}`}，${car.dir === "H" ? "左右" : "上下"}移動`}
                aria-disabled={editor ? undefined : won || disabled}
                className={`vehicle ${car.dir} ${car.len === 3 ? "bus" : ""} ${car.id === "target" ? "target" : ""} ${hinted ? "hinted" : ""} ${dragging ? "dragging" : ""} ${blocked === car.id ? "blocked" : ""} ${escaping ? "escaping" : ""}`}
                style={{ left: car.col * CELL + 4 + dx, top: car.row * CELL + 4 + dy, width: (car.dir === "H" ? car.len : 1) * CELL - 8, height: (car.dir === "V" ? car.len : 1) * CELL - 8, "--car-color": car.color }}
                onPointerDown={event => startDrag(event, car)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={event => endDrag(event, true)} onLostPointerCapture={event => endDrag(event, true)} onKeyDown={event => keyboardMove(event, car)}>
                <span className="car-roof" aria-hidden="true"><i className="window front" /><i className="window rear" /><i className="roof-stripe" /></span>
                <span className="wheels" aria-hidden="true" /><span className="headlights" aria-hidden="true" />
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
  );
}
