import React, { useEffect, useRef } from "react";

const paths = {
  undo: "M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12",
  reset: "M20 7v5h-5 M20 12a8 8 0 1 0-2 6",
  hint: "M9 18h6 M10 22h4 M8 14a7 7 0 1 1 8 0l-1 2H9z",
  levels: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  edit: "m16 3 5 5-12 12-6 1 1-6z M13 6l5 5",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  close: "m6 6 12 12 M18 6 6 18",
  garage: "m3 9 9-6 9 6v12H3z M7 21V11h10v10 M7 15h10 M7 18h10",
  settings:"M4 7h16 M4 17h16 M8 4v6 M16 14v6",
};

export function Sheet({label,onClose,children}) {
  const dialog=useRef(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const element=dialog.current,previous=document.activeElement,overflow=document.body.style.overflow;
    element.showModal();document.body.style.overflow='hidden';
    return()=>{element.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return <dialog ref={dialog} className="game-sheet" aria-label={label} onCancel={event=>{event.preventDefault();close.current();}} onClick={event=>{if(event.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close.current();}}}>{children}</dialog>;
}

export function Icon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.arrow} /></svg>;
}

export function WinDialog({ moves, stars, best, title, onClose, onRetry, onNext, hasNext, rewards=[] }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const returnFocus = previous?.matches(".vehicle") ? document.querySelector(".toolbar button:not(:disabled)") : previous;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.querySelector(".win-next").focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, []);

  function keyDown(event) {
    if (event.key === "Escape") onClose();
    if (event.key !== "Tab") return;
    const buttons = [...dialog.current.querySelectorAll("button")];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className="win-overlay">
    <div className="confetti" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ "--x": `${(i * 47) % 100}%`, "--delay": `${(i % 5) * 0.08}s`, "--turn": `${i * 59}deg`, "--confetti-color": ["#ffc857", "#72d2bd", "#ee7f75", "#8a9df1"][i % 4] }} />)}</div>
    <section ref={dialog} className="win-card" role="dialog" aria-modal="true" aria-labelledby="win-title" onKeyDown={keyDown}>
      <button className="dialog-close" onClick={onClose} aria-label="關閉通關結果"><Icon name="close" /></button>
      <div className="win-emblem" aria-hidden="true">✦</div>
      <p className="eyebrow">一路暢通</p>
      <h2 id="win-title">自由了！</h2>
      <p className="win-copy">紅車成功離開停車場。</p>
      <div className="win-stars" aria-label={`${stars} 顆星`}>{[1, 2, 3].map(i => <span key={i} className={i <= stars ? "earned" : ""} style={{ "--star-delay": `${i * 100}ms` }}>★</span>)}</div>
      <div className="win-score"><span><b>{moves}</b>本次步數</span><i /><span><b>{best ?? "—"}</b>最佳解</span></div>
      <p className="win-level">{title}</p>
      {rewards.length>0&&<div className="win-rewards" aria-label="本次新收藏">{rewards.map(r=><span key={r.id}>✦ {r.name}<small>{r.type}</small></span>)}</div>}
      <div className="win-actions"><button onClick={onRetry}><Icon name="reset" />再玩一次</button><button className="accent win-next" onClick={onNext}>{hasNext ? "下一關" : "選擇關卡"}<Icon name="arrow" /></button></div>
    </section>
  </div>;
}
