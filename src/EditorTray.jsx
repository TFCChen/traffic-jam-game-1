import React from 'react';
const vehicles = [
  ['小轎車', 'compact', 2, '#38bdf8'], ['越野車', 'jeep', 2, '#43a047'],
  ['皮卡', 'pickup', 2, '#fb8c00'], ['計程車', 'taxi', 2, '#ec4899'],
  ['校車', 'schoolbus', 3, '#fdd835'], ['城市巴士', 'coach', 3, '#2563eb'],
  ['露營車', 'camper', 3, '#059669'], ['貨運卡車', 'delivery', 3, '#9333ea'],
];
export default function EditorTray({ cars, tool, onChange, onCancel, disabled }) {
  const target = !cars.some(car => car.id === 'target');
  const options = target ? [['主角跑車', 'racer', 2, '#e53935']] : vehicles;
  function select(next) { onCancel(); onChange(next); }
  return <section className="editor-tray" aria-label="放置車輛工具">
    <div className="editor-tray-heading"><b>{target ? '先放置紅車' : '新增車輛'}</b><span>{target ? '出口列 · 2 格' : '選車 → 在空格拖拉放置'}</span></div>
    <div className="editor-vehicle-cards">{options.map(([name, kind, len, color]) =>
      <button key={kind} type="button" disabled={disabled} aria-pressed={target || (tool.color === color && tool.len === len)}
        onClick={() => select({ ...tool, len, color })} style={{ '--car-color': color }}>
        <span className={`mini-car ${kind}`} aria-hidden="true" /><b>{name}</b><small>{len} 格</small>
      </button>)}</div>
    <div className="editor-orientation" role="group" aria-label="放置方向">
      {[['H', '水平', '↔'], ['V', '垂直', '↕']].map(([dir, label, arrow]) =>
        <button key={dir} disabled={disabled || target && dir === 'V'} aria-pressed={(target ? 'H' : tool.dir) === dir}
          onClick={() => select({ ...tool, dir })}><span aria-hidden="true">{arrow}</span>{label}</button>)}
    </div>
    <p className="editor-placement-help">{target ? '亮起的格子可作為紅車起點。' : '淡色格是合法起點；預覽變紅表示無法放置。'}也可點起點與終點。</p>
  </section>;
}
