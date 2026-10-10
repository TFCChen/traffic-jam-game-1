import { validateLevel } from "./gameEngine.js";
const KEYS = {
  progress: "traffic-jam-progress-v2",
  custom: "traffic-jam-custom-levels-v2",
  draft: "traffic-jam-draft-v1",
  session: "traffic-jam-session-v1",
  tutorial: "traffic-jam-tutorial-v1",
};
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const validProgress = (value) =>
  object(value) &&
  Object.entries(value).every(
    ([key, v]) =>
      (/^(?:[1-9]|[1-3][0-9]|40)$/.test(key) ||
        /^custom-[\w-]{1,80}$/.test(key)) &&
      object(v) &&
      v.completed === true &&
      Number.isInteger(v.stars) &&
      v.stars >= 1 &&
      v.stars <= 3 &&
      Number.isInteger(v.bestMoves) &&
      v.bestMoves >= 0,
  );
const validCustom = (value) =>
  Array.isArray(value) &&
  value.length <= 200 &&
  new Set(value.map((v) => v?.id)).size === value.length &&
  value.every(
    (v) =>
      object(v) &&
      typeof v.id === "string" &&
      /^custom-[\w-]{1,80}$/.test(v.id) &&
      typeof v.title === "string" &&
      v.title.length <= 80 &&
      validateLevel(v.cars).valid,
  );
const validators = {
  progress: validProgress,
  custom: validCustom,
  draft: (v) =>
    object(v) &&
    Array.isArray(v.cars) &&
    (v.cars.length === 0 ||
      validateLevel(v.cars).errors.every((e) => e.includes("必須恰好"))) &&
    typeof v.title === "string" && v.title.length <= 80,
  session: (v) =>
    object(v) &&
    ((Number.isInteger(v.levelId) && v.levelId >= 1 && v.levelId <= 40) ||
      (typeof v.levelId === "string" && /^custom-[\w-]{1,80}$/.test(v.levelId))) &&
    validateLevel(v.cars).valid &&
    Array.isArray(v.history) &&
    v.history.every((c) => validateLevel(c).valid) &&
    Number.isInteger(v.moves) &&
    v.moves >= 0 &&
    v.moves === v.history.length,
  tutorial: (v) => typeof v === "boolean",
};
let storageIssue = "";
const blocked = new Set();
export const getStorageIssue = () => storageIssue;
function notify(message) {
  storageIssue = message;
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("garage-storage-error", { detail: message }),
    );
}
function read(name, fallback) {
  try {
    const raw = localStorage.getItem(KEYS[name]);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    const value = parsed?.schema === 1 ? parsed.data : parsed;
    if (!validators[name](value)) {
      blocked.add(name);
      notify("儲存資料格式不完整；原始資料已保留，請匯出備份後再修復。");
      return fallback;
    }
    return value;
  } catch {
    blocked.add(name);
    notify("無法讀取裝置存檔；遊戲仍可使用，請先匯出備份。");
    return fallback;
  }
}
function write(name, value) {
  if (blocked.has(name)) {
    notify("尚未保存：已保留損壞的原始存檔，請匯出備份並修復後再保存。");
    return false;
  }
  try {
    if (!validators[name](value)) throw Error("Invalid data");
    localStorage.setItem(
      KEYS[name],
      JSON.stringify(
        name === "progress" || name === "custom"
          ? value
          : { schema: 1, data: value },
      ),
    );
    return true;
  } catch {
    notify(
      "尚未保存到裝置：儲存空間或權限不足。請匯出備份；本次工作仍保留在畫面中。",
    );
    return false;
  }
}
export function repairStorage(data) {
  if (!validProgress(data.progress) || !validCustom(data.customLevels))
    return false;
  try {
    const recovery = Object.fromEntries(
      Object.entries(KEYS).map(([name, key]) => [
        name,
        localStorage.getItem(key),
      ]),
    );
    localStorage.setItem(
      `traffic-jam-recovery-${Date.now()}`,
      JSON.stringify(recovery),
    );
    const damaged = [...blocked];
    blocked.clear();
    for (const name of damaged) {
      if (name === "progress" || name === "custom") continue;
      if (name === "draft" && validators.draft(data.draft)) {
        if (!saveDraft(data.draft)) return false;
      } else localStorage.removeItem(KEYS[name]);
    }
    const a = saveProgress(data.progress),
      b = saveCustomLevels(data.customLevels);
    if (a && b) {
      storageIssue = "";
      notify("");
      return true;
    }
    return false;
  } catch {
    notify("無法保存原始資料備份，尚未修復或覆蓋存檔。請先匯出備份。");
    return false;
  }
}
export const loadProgress = () => read("progress", {}),
  saveProgress = (v) => write("progress", v);
export const loadCustomLevels = () => read("custom", []),
  saveCustomLevels = (v) => write("custom", v);
export const loadDraft = () => read("draft", null),
  saveDraft = (v) => write("draft", v);
export const loadSession = () => read("session", null),
  saveSession = (v) => write("session", v);
export const loadTutorial = () => read("tutorial", false),
  saveTutorial = (v) => write("tutorial", v);
export function exportBackup(data) {
  let recovery;
  try {
    if (storageIssue)
      recovery = Object.fromEntries(
        Object.entries(KEYS).map(([name, key]) => [
          name,
          localStorage.getItem(key),
        ]),
      );
  } catch {}
  return JSON.stringify(
    {
      format: "traffic-jam-backup",
      version: 1,
      created: new Date().toISOString(),
      ...data,
      recovery,
    },
    null,
    2,
  );
}
export function parseBackup(text) {
  if (text.length > 2_000_000) throw Error("備份檔過大。");
  const value = JSON.parse(text);
  if (
    value.format !== "traffic-jam-backup" ||
    value.version !== 1 ||
    !validCustom(value.customLevels) ||
    !validProgress(value.progress) ||
    (value.draft != null && !validators.draft(value.draft))
  )
    throw Error("備份格式或關卡資料無效。");
  return value;
}
export function downloadBackup(data) {
  const link = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([exportBackup(data)], { type: "application/json" }),
    );
  link.href = url;
  link.download = "traffic-jam-backup.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
