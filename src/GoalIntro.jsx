import React, { useEffect, useId, useRef, useState } from 'react';
import './goalIntro.css';

const DURATION = 4600;

function DemoCar({ paint, id }) {
  return <g>
    <rect x="-26" y="-20" width="16" height="40" rx="5" fill="#11181e" />
    <rect x="10" y="-20" width="16" height="40" rx="5" fill="#11181e" />
    <rect x="-39" y="-17" width="78" height="34" rx="12" fill={`url(#${id}-${paint})`} stroke="#ffffff45" />
    <path d="M-12-14H9L17-10V10L9 14H-12L-20 9V-9Z" fill="#182a36" stroke="#ffffff30" />
    <path d="M6-12 13-8V8L6 12Z" fill="#b0dce2" opacity=".8" />
    <path d="M-17-8-12-12V12L-17 8Z" fill="#7fa8b8" />
    <path d="M-9-11H2M-9 11H2" stroke="#b9d8e3" strokeWidth="2" opacity=".7" />
    <path d="M33-10V-5M33 5V10" stroke="#fff1c5" strokeWidth="3" strokeLinecap="round" />
    <path d="M-34-10V-6M-34 6V10" stroke="#ff8a74" strokeWidth="2" />
  </g>;
}

export default function GoalIntro({ onComplete }) {
  const dialog = useRef(null), complete = useRef(onComplete);
  const [paused, setPaused] = useState(document.hidden);
  const id = useId().replaceAll(':', '');
  complete.current = onComplete;
  useEffect(() => {
    const node = dialog.current, previousFocus = document.activeElement;
    node.showModal();
    let remaining = DURATION, started = 0, timer;
    const resume = () => {
      clearTimeout(timer);
      if (started) remaining -= performance.now() - started;
      started = 0;
      setPaused(document.hidden);
      if (!document.hidden) {
        started = performance.now();
        timer = setTimeout(() => complete.current(), Math.max(0, remaining));
      }
    };
    resume();
    document.addEventListener('visibilitychange', resume);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      node.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className="goal-intro" data-paused={paused}
    aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); complete.current(); }}>
    <button className="goal-intro-close" aria-label="略過通關演示" onClick={() => complete.current()}>×</button>
    <div className="goal-intro-heading"><span>通關目標</span><h2 id={`${id}-title`}>讓紅車出庫</h2></div>
    <svg className="goal-demo" viewBox="0 0 440 190" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-red`} x2="0" y2="1"><stop stopColor="#ff9580"/><stop offset=".45" stopColor="#f0443e"/><stop offset="1" stopColor="#9c222c"/></linearGradient>
        <linearGradient id={`${id}-blue`} x2="0" y2="1"><stop stopColor="#9bc5f2"/><stop offset=".45" stopColor="#467fc0"/><stop offset="1" stopColor="#294766"/></linearGradient>
        <linearGradient id={`${id}-road`}><stop stopColor="#f4cf7a" stopOpacity="0"/><stop offset="1" stopColor="#f4cf7a" stopOpacity=".16"/></linearGradient>
      </defs>
      <rect x="24" y="12" width="312" height="166" rx="15" fill="#121b23" stroke="#ffffff1c"/>
      <path d="M38 22H326M38 168H326M34 32V158M326 26V73M326 131V164" stroke="#718083" strokeWidth="3" strokeLinecap="round"/>
      <path d="M52 57H304M52 147H304M88 33V163M145 33V163M202 33V163M259 33V163" stroke="#ffffff09" strokeDasharray="3 8"/>
      <path d="M88 102H408" stroke={`url(#${id}-road)`} strokeWidth="42"/>
      <path className="goal-route" d="M105 102H401M391 93 401 102 391 111" fill="none" stroke="#edcc86" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <g className="goal-blocker"><g transform="translate(233 106) rotate(-90) scale(.78)"><DemoCar paint="blue" id={id}/></g></g>
      <g className="goal-blocker-arrow" fill="none" stroke="#c6dcf2" strokeWidth="2.5" strokeLinecap="round"><path d="M278 100V39M271 46 278 39 285 46"/></g>
      <g className="goal-hero"><g transform="translate(103 102)"><DemoCar paint="red" id={id}/></g></g>
      <path className="goal-exit-glow" d="M326 76V128" stroke="#f2d499" strokeWidth="4" strokeLinecap="round"/>
      <text x="372" y="151" fill="#e9d4a6" fontSize="12" textAnchor="middle" letterSpacing="3">出口</text>
    </svg>
    <p id={`${id}-description`}><span>沿車身拖動</span><i>→</i><span>移開擋車</span><i>→</i><strong>紅車向右出庫</strong></p>
    <div className="goal-intro-progress" aria-hidden="true"><span/></div>
  </dialog>;
}
