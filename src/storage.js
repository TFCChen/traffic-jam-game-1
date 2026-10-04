const PROGRESS_KEY = "traffic-jam-progress-v2";
const CUSTOM_KEY = "traffic-jam-custom-levels-v2";

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export const loadProgress = () => read(PROGRESS_KEY, {});
export const saveProgress = (progress) => localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
export const loadCustomLevels = () => read(CUSTOM_KEY, []);
export const saveCustomLevels = (levels) => localStorage.setItem(CUSTOM_KEY, JSON.stringify(levels));
