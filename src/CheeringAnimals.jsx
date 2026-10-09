import React, { useId } from 'react';
import sprites from './referenceMascots.json';
import './cheeringAnimals.css';

const CAST = [
  { kind: 'rabbit', corner: 'top-left', slot: 'lead', angle: 135, tempo: .72 },
  { kind: 'sheep', corner: 'top-left', slot: 'friend', angle: 174, tempo: .83 },
  { kind: 'goat', corner: 'top-right', slot: 'lead', angle: -135, tempo: .61 },
  { kind: 'mouse', corner: 'top-right', slot: 'friend', angle: -174, tempo: .76 },
  { kind: 'cow', corner: 'bottom-left', slot: 'lead', angle: 45, tempo: .68 },
  { kind: 'pig', corner: 'bottom-left', slot: 'friend', angle: 8, tempo: .91 },
  { kind: 'chick', corner: 'bottom-right', slot: 'lead', angle: -45, tempo: .65 },
  { kind: 'dog', corner: 'bottom-right', slot: 'friend', angle: -8, tempo: .8 },
];

// Clip the three generated alpha islands from one shared image. Nested viewBox
// preserves each island's proportions; CSS only articulates the detached paws.
function PlushPart({ sprite, part, id, x, y, width, height }) {
  const region = sprite[part];
  return <svg x={x} y={y} width={width} height={height} viewBox={region.box.join(' ')} preserveAspectRatio="xMidYMid meet" overflow="hidden">
    <defs><clipPath id={id}><path d={region.clip}/></clipPath></defs>
    <image href={sprite.src} width={sprite.width} height={sprite.height} clipPath={`url(#${id})`}/>
  </svg>;
}

function Animal({ character, id, index }) {
  const { kind, corner, slot, angle, tempo } = character;
  const sprite = sprites[kind];
  return <div className={`cheering-guest ${corner} ${slot} guest-${kind}`} style={{ '--angle': `${angle}deg`, '--tempo': `${tempo}s`, '--clap-delay': `${-index * .17}s`, '--arrival': `${index * .045}s` }}>
    <svg viewBox="0 0 112 128" preserveAspectRatio="xMidYMid meet" focusable="false">
      <g className="cheering-animal">
        <PlushPart sprite={sprite} part="body" id={`${id}-${kind}-body`} x={3} y={0} width={106} height={128}/>
        <g className="cheering-hands">
          <g className="cheering-paw cheering-paw-left"><PlushPart sprite={sprite} part="left" id={`${id}-${kind}-left`} x={24} y={96} width={24} height={26}/></g>
          <g className="cheering-paw cheering-paw-right"><PlushPart sprite={sprite} part="right" id={`${id}-${kind}-right`} x={64} y={96} width={24} height={26}/></g>
          <g className="cheering-clap" fill="none" stroke="#f9dca0" strokeWidth="1.6" strokeLinecap="round"><path d="M56 99v-4m-7 6-3-3m17 3 3-3"/></g>
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
