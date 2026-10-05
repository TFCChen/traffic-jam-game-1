const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const DEFAULT_VIEW = {
  pitch: 60,
  yaw: -12,
  zoom: 1,
  panX: 0,
  panY: 0,
  focusX: 0,
  focusZ: 0,
};
const number = (v, fallback) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;
export function normalizeView(value = {}) {
  const yaw = number(value.yaw, DEFAULT_VIEW.yaw);
  return {
    pitch: clamp(number(value.pitch, DEFAULT_VIEW.pitch), 30, 80),
    yaw: ((((yaw + 180) % 360) + 360) % 360) - 180,
    zoom: clamp(number(value.zoom, 1), 0.65, 4),
    panX: clamp(number(value.panX, 0), -8, 8),
    panY: clamp(number(value.panY, 0), -8, 8),
    focusX: clamp(number(value.focusX, 0), -32, 32),
    focusZ: clamp(number(value.focusZ, 0), -32, 32),
  };
}
export function rotateView(view, dx, dy) {
  return normalizeView({
    ...view,
    yaw: view.yaw - dx * 0.3,
    pitch: view.pitch + dy * 0.22,
  });
}
export function panView(view, dx, dy, width, height, pixelsWide, pixelsHigh) {
  return normalizeView({
    ...view,
    panX: view.panX - (dx * width) / Math.max(1, pixelsWide),
    panY: view.panY + (dy * height) / Math.max(1, pixelsHigh),
  });
}
export function zoomView(view, zoom, nx, ny, width, height) {
  const next = normalizeView({ ...view, zoom }),
    ratio = view.zoom / next.zoom;
  return normalizeView({
    ...next,
    panX: view.panX + nx * width * (1 - ratio),
    panY: view.panY + ny * height * (1 - ratio),
  });
}
export function touchPair(points) {
  const [a, b] = points;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
  };
}
