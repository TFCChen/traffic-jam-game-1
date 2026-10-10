export function mergeBackup(
  progress,
  customLevels,
  data,
  makeId = () => `custom-${crypto.randomUUID()}`,
) {
  const merged = [...customLevels],
    remap = new Map();
  for (const level of data.customLevels) {
    const existing = merged.find((v) => v.id === level.id);
    if (!existing) merged.push(level);
    else if (JSON.stringify(existing) !== JSON.stringify(level)) {
      const id = makeId();
      remap.set(level.id, id);
      merged.push({
        ...level,
        id,
        title: `${level.title.slice(0, 65)}（匯入）`,
      });
    }
  }
  if (merged.length > 200) throw Error("關卡數量上限為 200。");
  const next = { ...progress };
  for (const [source, value] of Object.entries(data.progress)) {
    const id = remap.get(source) ?? source,
      old = next[id];
    next[id] = {
      ...value,
      stars: Math.max(old?.stars ?? 0, value.stars),
      bestMoves: Math.min(old?.bestMoves ?? Infinity, value.bestMoves),
      perfect: old?.perfect === true || value.perfect === true,
    };
  }
  return { progress: next, customLevels: merged };
}
