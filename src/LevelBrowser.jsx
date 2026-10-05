import React, { useMemo } from "react";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "./levelCatalog.js";
import { LevelThumbnail } from "./LevelThumbnail.jsx";
const levelKey = (level) => String(level.id);
export default function LevelBrowser({
  levels,
  current,
  progress,
  onSelect,
  layouts,
}) {
  const groups = useMemo(
    () =>
      Object.fromEntries(
        DIFFICULTIES.map((name) => [
          name,
          levels.filter((level) => level.difficulty === name),
        ]),
      ),
    [levels],
  );

  return (
    <div className="level-browser">
      {DIFFICULTIES.map((difficulty) => (
        <section key={difficulty}>
          <h3>{DIFFICULTY_LABELS[difficulty]}</h3>
          <div className="level-grid">
            {groups[difficulty].map((level) => {
              const result = progress[levelKey(level)];
              return (
                <button
                  key={level.id}
                  className={current?.id === level.id ? "active" : ""}
                  aria-label={`第 ${level.id} 關${result ? `，已獲得 ${result.stars} 顆星` : ""}`}
                  aria-current={current?.id === level.id ? "true" : undefined}
                  onClick={() => onSelect(level)}
                >
                  <LevelThumbnail cars={layouts?.[level.id]?.cars} />
                  <b>{level.id}</b>
                  <small>{result ? "★".repeat(result.stars) : "—"}</small>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
