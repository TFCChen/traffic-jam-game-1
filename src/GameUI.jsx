import React, { useEffect, useRef } from "react";
import CheeringAnimals from './CheeringAnimals.jsx';

const paths = {
  undo: "M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12",
  reset: "M20 7v5h-5 M20 12a8 8 0 1 0-2 6",
  hint: "M9 18h6 M10 22h4 M8 14a7 7 0 1 1 8 0l-1 2H9z",
  levels: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  edit: "m16 3 5 5-12 12-6 1 1-6z M13 6l5 5",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  close: "m6 6 12 12 M18 6 6 18",
  garage: "m3 9 9-6 9 6v12H3z M7 21V11h10v10 M7 15h10 M7 18h10",
  settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
  install: "M12 3v12m-5-5 5 5 5-5M5 17v3h14v-3",
};

export function Sheet({ label, onClose, children }) {
  const dialog = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current,
      previous = document.activeElement,
      overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="game-sheet"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          const r = dialog.current.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            close.current();
        }
      }}
    >
      {children}
    </dialog>
  );
}

export function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.arrow} />
    </svg>
  );
}

export function WinDialog({
  moves,
  stars,
  best,
  title,
  onClose,
  onRetry,
  onNext,
  hasNext,
  nextLabel,
  rewards = [],
  finale = false,
  summary,
  nextTitle,
}) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const returnFocus = previous?.matches(".vehicle")
      ? document.querySelector(".toolbar button:not(:disabled)")
      : previous;
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
    const first = buttons[0],
      last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="win-overlay has-cheering">
      <div className="win-celebration">
      <CheeringAnimals />
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <i
            key={i}
            style={{
              "--x": `${(i * 47) % 100}%`,
              "--delay": `${(i % 5) * 0.08}s`,
              "--turn": `${i * 59}deg`,
              "--confetti-color": ["#e7c887", "#c5c5a8", "#dca9a3", "#eee0c5"][
                i % 4
              ],
            }}
          />
        ))}
      </div>
      <section
        ref={dialog}
        className="win-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="win-title"
        onKeyDown={keyDown}
      >
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label="關閉通關結果"
        >
          <Icon name="close" />
        </button>
        <p className="eyebrow">一路暢通</p>
        <h2 id="win-title">{finale ? "四十關之旅完成！" : best != null && moves === best ? "完美出庫" : "順利出庫"}</h2>
        {finale && <p className="win-copy">最後一台紅車已出庫，看看你的車庫收藏。</p>}
        <div className="win-stars" aria-label={`${stars} 顆星`}>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={i <= stars ? "earned" : ""}
              style={{ "--star-delay": `${i * 100}ms` }}
            >
              ★
            </span>
          ))}
        </div>
        <div className="win-score">
          <span>
            <b>{moves}</b>本次步數
          </span>
          <i />
          <span>
            <b>{best ?? "—"}</b>最佳解
          </span>
        </div>
        <p className="win-level">{title}</p>
        {best != null && <p className="win-performance">{moves === best ? '每一步都恰到好處 · 最佳解達成' : `距離最佳解 ${Math.max(0, moves - best)} 步 · 再挑戰一次？`}</p>}
        {finale && summary && (
          <p className="journey-summary">
            完成 {summary.completed}/40 關 · 共 {summary.stars} 星 ·{" "}
            {summary.perfect} 關最佳解
          </p>
        )}
        {rewards.length > 0 && (
          <div className="win-rewards" aria-label="本次新收藏">
            {rewards.map((r) => (
              <span key={r.id} className={`reward-${r.id}`}>
                ✦ {r.name}
                <small>{r.type}</small>
                {r.type === "場景解鎖" && (
                  <svg
                    viewBox="0 0 130 58"
                    className={`scene-preview preview-${r.id}`}
                    aria-hidden="true"
                  >
                    <path d="M12 39 75 19 119 36 55 57Z" fill="#babfac" />
                    <path d="M21 38 75 23 106 36 54 51Z" fill="#394e4e" />
                    <path
                      d="m25 38 29 12m-19-15 29 12m-19-15 29 12m-19-15 29 12m-19-15 29 12M31 42l53-15M41 46l53-15"
                      stroke="#d9d7bd"
                      strokeWidth=".65"
                      opacity=".6"
                    />
                    <path
                      d="M13 35 75 16 118 32m-43-16v6M13 35v5m105-8v6"
                      fill="none"
                      stroke="#e7e2c8"
                      strokeWidth="1.4"
                    />
                    <g transform="matrix(1 -.3 .8 .35 48 35)">
                      <rect
                        x="0"
                        y="0"
                        width="22"
                        height="10"
                        rx="3"
                        fill="#e65542"
                      />
                      <rect
                        x="6"
                        y="1"
                        width="9"
                        height="8"
                        rx="2"
                        fill="#53777b"
                      />
                      <rect
                        x="27"
                        y="-10"
                        width="22"
                        height="10"
                        rx="3"
                        fill="#e9bb55"
                      />
                      <rect
                        x="32"
                        y="-9"
                        width="10"
                        height="8"
                        rx="2"
                        fill="#53777b"
                      />
                    </g>
                    <path
                      d="M16 30V16h8m87 12V15h-7"
                      fill="none"
                      stroke="#647368"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M17 15h8m78 0h8"
                      stroke="#fff0b4"
                      strokeWidth="3"
                    />
                    <ellipse cx="98" cy="40" rx="4" ry="2" fill="#697858" />
                    <path d="M98 37v4" stroke="#7b6345" strokeWidth="2" />
                    <circle cx="98" cy="34" r="4" fill="#80a374" />
                  </svg>
                )}
              </span>
            ))}
          </div>
        )}
        <div className="win-actions">
          <button onClick={onRetry}>
            <Icon name="reset" />
            再玩一次
          </button>
          <button className="accent win-next" onClick={onNext}>
            {nextLabel || (hasNext ? "下一關" : "選擇關卡")}
            <Icon name="arrow" />
          </button>
        </div>
        {nextTitle && <p className="win-up-next">下一站 · {nextTitle}</p>}
      </section>
      </div>
    </div>
  );
}
