import React from "react";
export function LevelThumbnail({ cars = [] }) {
  return (
    <svg className="level-thumbnail" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="1" y="1" width="60" height="60" rx="6" fill="#162a23" />
      {cars.map((c) => (
        <rect
          key={c.id}
          x={c.col * 10 + 3}
          y={c.row * 10 + 3}
          width={c.dir === "H" ? c.len * 10 - 4 : 6}
          height={c.dir === "V" ? c.len * 10 - 4 : 6}
          rx="2"
          fill={c.color}
        />
      ))}
      <path d="m61 23 3 3-3 3" fill="none" stroke="#f4d889" strokeWidth="2" />
    </svg>
  );
}
