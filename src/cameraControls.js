const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
// Orthographic size is independent of distance. Keep the entire 200-unit
// ground and movable orbit target ahead of the camera, even at low angles.
export const ORTHOGRAPHIC_DISTANCE = 200;
export const ORTHOGRAPHIC_FAR = 400;
export const DEFAULT_VIEW = {
  pitch: 90,
  yaw: 0,
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
    pitch: clamp(number(value.pitch, DEFAULT_VIEW.pitch), 30, 90),
    yaw: ((((yaw + 180) % 360) + 360) % 360) - 180,
    zoom: clamp(number(value.zoom, 1), 0.65, 4),
    // Conservative storage limits; scene bounds account for orbit focus offsets.
    panX: clamp(number(value.panX, 0), -64, 64),
    panY: clamp(number(value.panY, 0), -64, 64),
    focusX: clamp(number(value.focusX, 0), -32, 32),
    focusZ: clamp(number(value.focusZ, 0), -32, 32),
  };
}
// A yaw-aware up vector remains well-defined at an exact vertical view.
// World Y as camera.up becomes parallel to the viewing ray at 90 degrees.
export function viewUp(view) {
  const p = view.pitch * Math.PI / 180, y = view.yaw * Math.PI / 180;
  return [-Math.sin(y) * Math.sin(p), Math.cos(p), -Math.cos(y) * Math.sin(p)];
}
export function restoreView(value = {}) {
  const oldPreset = [60, 70].includes(value.pitch) && value.yaw === -12 &&
    (value.zoom ?? 1) === 1 &&
    ['panX', 'panY', 'focusX', 'focusZ'].every(k => (value[k] ?? 0) === 0);
  return oldPreset ? {...DEFAULT_VIEW} : normalizeView(value);
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
