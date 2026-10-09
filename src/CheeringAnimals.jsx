import React, { useId } from 'react';
import './cheeringAnimals.css';

const palettes = {
  bear: ['#e9bc83', '#bd8256', '#ffdfb5'],
  bunny: ['#f8eee0', '#d6bca7', '#fff8ef'],
  cat: ['#adcbd3', '#6e99ae', '#dfeef0'],
};

function Animal({ kind, x, delay, id }) {
  const [fur, shade, cream] = palettes[kind];
  return <g transform={`translate(${x} 12)`}>
    <g className="cheering-animal" style={{ '--clap-delay': `${delay}s` }}>
      <ellipse cx="38" cy="106" rx="30" ry="5" fill="#0d1829" opacity=".16" />
      <ellipse cx="38" cy="81" rx="25" ry="28" fill={`url(#${id}-${kind})`} />
      <ellipse cx="38" cy="84" rx="17" ry="20" fill={cream} />
      <ellipse cx="21" cy="103" rx="11" ry="6" fill={shade} />
      <ellipse cx="55" cy="103" rx="11" ry="6" fill={shade} />
      {kind === 'bunny' ? <>
        <ellipse cx="24" cy="21" rx="9" ry="23" transform="rotate(-12 24 21)" fill={fur} />
        <ellipse cx="51" cy="19" rx="9" ry="23" transform="rotate(10 51 19)" fill={fur} />
        <ellipse cx="24" cy="20" rx="4" ry="16" transform="rotate(-12 24 21)" fill="#e9b5b0" />
        <ellipse cx="51" cy="18" rx="4" ry="16" transform="rotate(10 51 19)" fill="#e9b5b0" />
      </> : kind === 'cat' ? <>
        <path d="M12 42 13 15Q26 19 30 32M46 32Q57 19 65 15L64 43" fill={fur} stroke={shade} strokeWidth="1.5" />
        <path d="M17 31 18 22 25 31M52 31 60 22 60 34" fill="#d7aeb2" />
      </> : <>
        <circle cx="16" cy="31" r="12" fill={shade} /><circle cx="60" cy="31" r="12" fill={shade} />
        <circle cx="16" cy="31" r="7" fill="#e3af95" /><circle cx="60" cy="31" r="7" fill="#e3af95" />
      </>}
      <ellipse cx="38" cy="47" rx="30" ry="27" fill={`url(#${id}-${kind})`} />
      <ellipse cx="38" cy="57" rx="16" ry="12" fill={cream} />
      <path d="M21 44q4-6 8 0M47 44q4-6 8 0" fill="none" stroke="#35414d" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="17" cy="54" rx="6" ry="3.5" fill="#eaa3a0" opacity=".65" />
      <ellipse cx="59" cy="54" rx="6" ry="3.5" fill="#eaa3a0" opacity=".65" />
      <path d="M34 52q4-4 8 0l-4 4Z" fill="#765b5d" />
      <path d="M38 56v3m-6 0q6 7 12 0" fill="none" stroke="#765b5d" strokeWidth="1.5" strokeLinecap="round" />
      {kind === 'cat' && <path d="M9 53 0 51m10 7-9 2m65-7 9-2m-10 7 9 2" stroke="#688697" strokeWidth="1.2" strokeLinecap="round" />}
      <path d="m27 70 11 5 11-5-3 10H30Z" fill={kind === 'bear' ? '#b86a64' : kind === 'cat' ? '#d9af65' : '#9fabc8'} />
      <g className="cheering-paw cheering-paw-left">
        <ellipse cx="23" cy="81" rx="9" ry="13" transform="rotate(-26 23 81)" fill={fur} stroke={shade} strokeWidth="1" />
        <ellipse cx="25" cy="79" rx="4" ry="5" fill="#e6aaa3" opacity=".8" />
      </g>
      <g className="cheering-paw cheering-paw-right">
        <ellipse cx="53" cy="81" rx="9" ry="13" transform="rotate(26 53 81)" fill={fur} stroke={shade} strokeWidth="1" />
        <ellipse cx="51" cy="79" rx="4" ry="5" fill="#e6aaa3" opacity=".8" />
      </g>
      <g className="cheering-clap" fill="none" stroke="#f5d997" strokeWidth="2" strokeLinecap="round">
        <path d="M38 68v-5M30 70l-3-4M46 70l3-4" />
      </g>
    </g>
  </g>;
}

export default function CheeringAnimals() {
  const id = useId().replaceAll(':', '');
  return <div className="cheering-corners" aria-hidden="true">
    {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner, index) =>
      <svg key={corner} className={`cheering-corner ${corner}`} viewBox="0 0 232 128" preserveAspectRatio="xMidYMid meet" focusable="false">
        <defs>{Object.entries(palettes).map(([kind, [fur, shade]]) =>
          <radialGradient key={kind} id={`${id}-${index}-${kind}`} cx="35%" cy="22%" r="85%"><stop stopColor={fur} /><stop offset="1" stopColor={shade} /></radialGradient>
        )}</defs>
        {['bear', 'bunny', 'cat'].map((kind, i) =>
          <Animal key={kind} kind={kind} x={i * 76} delay={-(i * .18 + index * .13)} id={`${id}-${index}`} />
        )}
      </svg>
    )}
  </div>;
}
