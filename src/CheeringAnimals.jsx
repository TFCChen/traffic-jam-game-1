import React, { useId } from 'react';
import './cheeringAnimals.css';

// Eight unique silhouettes and expressions; portrait phones move the friends
// to the side edges, without repeating any character on screen.
const CAST = [
  { kind: 'rabbit', corner: 'top-left', slot: 'lead', fur: '#fff2e5', shade: '#d5bcae', angle: 135, tempo: .72 },
  { kind: 'owl', corner: 'top-left', slot: 'friend', fur: '#c9b4de', shade: '#8b78a9', angle: 174, tempo: .83 },
  { kind: 'fox', corner: 'top-right', slot: 'lead', fur: '#efb16f', shade: '#c57350', angle: -135, tempo: .61 },
  { kind: 'panda', corner: 'top-right', slot: 'friend', fur: '#f1eee5', shade: '#c5c4bf', angle: -174, tempo: .76 },
  { kind: 'otter', corner: 'bottom-left', slot: 'lead', fur: '#cda98b', shade: '#93705c', angle: 45, tempo: .68 },
  { kind: 'hedgehog', corner: 'bottom-left', slot: 'friend', fur: '#f3d4a4', shade: '#c09a78', angle: 8, tempo: .91 },
  { kind: 'cat', corner: 'bottom-right', slot: 'lead', fur: '#adcfd8', shade: '#6b9eb1', angle: -45, tempo: .65 },
  { kind: 'dog', corner: 'bottom-right', slot: 'friend', fur: '#f1d49e', shade: '#c49b6f', angle: -8, tempo: .8 },
];

function Head({ kind, paint, fur, shade }) {
  switch (kind) {
    case 'rabbit': return <>
      <path d="M33 32Q15-4 28 0q12 3 16 29M64 28Q64-1 77 5q10 9-1 32" fill={fur}/>
      <path d="M31 8q5 7 8 19M73 12q-3 7-3 15" stroke="#e8b5b3" strokeWidth="5" strokeLinecap="round"/>
      <path d="M23 46q-3-23 31-25 32 1 33 26 0 27-32 28-33-2-32-29" fill={paint}/>
      <path d="M34 46q5-7 10 0M66 45q5-7 10 0" fill="none" stroke="#60515a" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="m50 53 5 4 5-4" fill="#c88c98"/><path d="M46 61q9 10 18-1" fill="#b57782"/>
      <path d="M53 61v5h5v-5" fill="#fffaf3"/><ellipse cx="31" cy="56" rx="6" ry="3" fill="#eebbb7"/><ellipse cx="79" cy="55" rx="6" ry="3" fill="#eebbb7"/>
    </>;
    case 'owl': return <>
      <path d="M20 36 24 15l17 10q14-5 28 0l18-11-1 24q16 35-9 42H33Q10 70 20 36" fill={paint}/>
      <path d="M22 45q0-20 21-18l12 9 13-9q22-2 21 19-1 23-23 24L55 61 44 70Q22 67 22 45" fill="#f1e9ed"/>
      <ellipse cx="39" cy="46" rx="9" ry="11" fill="#5a4c70"/><ellipse cx="72" cy="46" rx="9" ry="11" fill="#5a4c70"/>
      <circle cx="41" cy="42" r="3" fill="white"/><circle cx="74" cy="42" r="3" fill="white"/>
      <path d="m50 53 6-4 6 4-6 9Z" fill="#e2b769"/><path d="m39 72 5 5m9-4 4 5m9-6 5 4" stroke={shade} strokeWidth="2"/>
    </>;
    case 'fox': return <>
      <path d="M21 42 20 7l25 21q12-5 21-1L91 8l-2 37-11 22-22 13-25-14Z" fill={paint}/>
      <path d="m25 17 4 22 11-10m33 0 12-12-4 22" fill="#714e56"/>
      <path d="M24 44q13 1 24 15l8-2 9 2q12-15 24-15-2 25-33 35-30-10-32-35" fill="#fff0d6"/>
      <path d="m34 44 9 3-9 3" fill="none" stroke="#5a4147" strokeWidth="2.6" strokeLinecap="round"/>
      <ellipse cx="74" cy="46" rx="4" ry="5" fill="#5a4147"/><circle cx="75" cy="44" r="1.4" fill="white"/>
      <path d="m50 58 6-3 6 3-6 6Z" fill="#60464e"/><path d="M48 68q10 7 18-3" fill="none" stroke="#9a6567" strokeWidth="2" strokeLinecap="round"/>
    </>;
    case 'panda': return <>
      <circle cx="28" cy="27" r="14" fill="#414b59"/><circle cx="82" cy="27" r="14" fill="#414b59"/>
      <ellipse cx="55" cy="49" rx="36" ry="30" fill={paint}/>
      <ellipse cx="38" cy="46" rx="11" ry="14" transform="rotate(22 38 46)" fill="#4e5865"/><ellipse cx="73" cy="46" rx="11" ry="14" transform="rotate(-22 73 46)" fill="#4e5865"/>
      <path d="M32 47q5-6 11 0M67 47q5-6 11 0" fill="none" stroke="#f7f1e7" strokeWidth="2.7" strokeLinecap="round"/>
      <ellipse cx="55" cy="58" rx="5" ry="3.5" fill="#48525f"/><path d="M49 65q6 5 12 0" fill="none" stroke="#48525f" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="28" cy="59" r="5" fill="#e9b9b2" opacity=".7"/><circle cx="82" cy="59" r="5" fill="#e9b9b2" opacity=".7"/>
    </>;
    case 'otter': return <>
      <circle cx="24" cy="39" r="10" fill={shade}/><circle cx="85" cy="39" r="10" fill={shade}/>
      <ellipse cx="55" cy="49" rx="37" ry="27" fill={paint}/>
      <path d="M24 53q11-17 31-7 23-10 34 7-2 22-34 23-28-2-31-23" fill="#f4dfc3"/>
      <ellipse cx="36" cy="44" rx="3.2" ry="4.5" fill="#4c4346"/><ellipse cx="75" cy="44" rx="3.2" ry="4.5" fill="#4c4346"/>
      <path d="M48 54q7-5 14 0l-7 7Z" fill="#6f5454"/><path d="M45 63q10 12 21-1" fill="#a26b6a"/>
      <path d="M24 56 12 53m13 9-12 2m73-8 12-3m-13 9 12 2" stroke="#9a7767" strokeWidth="1.4" strokeLinecap="round"/>
    </>;
    case 'hedgehog': return <>
      <path d="m17 54-7-13 13-2-3-14 13 2 4-15 12 9L59 8l7 13 16-6-1 15 15 1-6 12 12 10-12 9-15 13H31Z" fill="#84645e"/>
      <path d="M26 52q-3-24 29-23 30 0 31 24-2 23-30 24-28-1-30-25" fill={paint}/>
      <circle cx="38" cy="48" r="3" fill="#624b4b"/><path d="M68 49q5-6 10-1" fill="none" stroke="#624b4b" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="56" cy="58" rx="5" ry="3.5" fill="#624b4b"/><path d="m51 66 5 2 7-3" fill="none" stroke="#986b67" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="33" cy="58" r="4" fill="#e8ad9a"/><circle cx="79" cy="59" r="4" fill="#e8ad9a"/>
    </>;
    case 'cat': return <>
      <path d="M22 44 24 11l22 17q12-3 20 0L89 9l-1 37q7 31-33 33-38-1-33-35" fill={paint}/>
      <path d="m29 23 3 15 8-8m32 0 10-9-2 16" fill="#dbaeb5"/>
      <path d="m48 27 4 8m9-8-3 8" stroke={shade} strokeWidth="3" strokeLinecap="round"/>
      <path d="m31 48 5-4 6 4m26-1 5-4 6 4" fill="none" stroke="#3f5e70" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="m51 55 5 4 5-4" fill="#b98594"/><path d="M56 59q-6 8-10 2m10-2q6 8 10 2" fill="none" stroke="#698494" strokeWidth="1.8"/>
      <path d="m27 56-13-3m13 9-13 2m70-8 13-3m-13 9 13 2" stroke="#7393a5" strokeWidth="1.5" strokeLinecap="round"/>
    </>;
    default: return <>
      <path d="M30 25Q6 20 13 60q4 13 14 1M78 25q26-6 19 35-4 13-14 1" fill="#a87559"/>
      <path d="M23 45q-2-25 32-25 32 0 34 27 2 32-34 32-34 0-32-34" fill={paint}/>
      <path d="M30 29q15-12 22 4v18q-20 7-24-5Z" fill="#b68463"/>
      <ellipse cx="38" cy="44" rx="4" ry="5" fill="#4f4149"/><circle cx="39" cy="42" r="1.5" fill="white"/>
      <path d="M68 45q5-6 10 0" stroke="#4f4149" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="56" cy="59" rx="18" ry="12" fill="#fff0d3"/><ellipse cx="56" cy="54" rx="6" ry="4" fill="#64515a"/>
      <path d="M48 62q8 9 16 0" fill="#925969"/><path d="M54 65h7v6q-4 7-7 0Z" fill="#e7a0a5"/>
    </>;
  }
}

function Animal({ character, id, index }) {
  const { kind, fur, shade, corner, slot, angle, tempo } = character;
  const paint = `url(#${id}-${kind})`;
  const paw = kind === 'panda' ? '#46515e' : kind === 'owl' ? '#a28abb' : fur;
  return <div className={`cheering-guest ${corner} ${slot} guest-${kind}`} style={{ '--angle': `${angle}deg`, '--tempo': `${tempo}s`, '--clap-delay': `${-index * .17}s`, '--arrival': `${index * .045}s` }}>
    <svg viewBox="0 0 112 128" preserveAspectRatio="xMidYMid meet" focusable="false">
      <defs><radialGradient id={`${id}-${kind}`} cx="35%" cy="20%" r="85%"><stop stopColor={fur}/><stop offset="1" stopColor={shade}/></radialGradient></defs>
      <g className="cheering-animal">
        <path d="M25 124V99q0-31 30-32 32 0 32 32v25Z" fill={paint}/>
        <ellipse cx="56" cy="108" rx="20" ry="23" fill={kind === 'panda' ? '#414c59' : '#fff0d5'} opacity=".85"/>
        <Head kind={kind} paint={paint} fur={fur} shade={shade}/>
        {kind === 'fox' && <path d="m37 78 19 7 20-7-5 12-15 1-7 20-9-5 7-18Z" fill="#829d87"/>}
        {kind === 'otter' && <path d="M35 78q21 9 41-1l-2 8q-18 9-37 0Z" fill="#88adb9"/>}
        {kind === 'cat' && <path d="m42 80 14 6 13-6v13l-13-5-14 5Z" fill="#dfb76d"/>}
        <g className="cheering-hands">
        <g className="cheering-paw cheering-paw-left"><path d={kind === 'owl' ? 'M28 84q-14 5-6 22l21 4 3-12Z' : 'M28 85q-15 4-6 21 8 12 20 1 10-15-14-22'} fill={paw} stroke={shade} strokeWidth="1"/><path d="m28 92 5 5m-9 1 5 4" stroke={shade} opacity=".5" strokeWidth="1.4" strokeLinecap="round"/></g>
        <g className="cheering-paw cheering-paw-right"><path d={kind === 'owl' ? 'M83 84q14 5 6 22l-21 4-3-12Z' : 'M83 85q15 4 6 21-8 12-20 1-10-15 14-22'} fill={paw} stroke={shade} strokeWidth="1"/><path d="m83 92-5 5m9 1-5 4" stroke={shade} opacity=".5" strokeWidth="1.4" strokeLinecap="round"/></g>
        <g className="cheering-clap" stroke="#f9dca0" strokeWidth="2" strokeLinecap="round"><path d="M55 90v-5m-9 7-3-4m22 4 3-4"/></g>
        </g>
      </g>
    </svg>
  </div>;
}

export default function CheeringAnimals() {
  const id = useId().replaceAll(':', '');
  return <div className="cheering-corners" aria-hidden="true">
    {CAST.map((character, index) => <Animal key={character.kind} character={character} id={id} index={index}/>)}
  </div>;
}
