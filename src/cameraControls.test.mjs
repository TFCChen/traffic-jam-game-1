import assert from "node:assert/strict";
import {
  DEFAULT_VIEW,
  normalizeView,
  rotateView,
  panView,
  zoomView,
  touchPair,
} from "./cameraControls.js";
assert.deepEqual(
  normalizeView({ pitch: NaN, yaw: Infinity, zoom: NaN, panX: Infinity }),
  DEFAULT_VIEW,
);
assert.equal(normalizeView({ pitch: -100, zoom: 100 }).pitch, 30);
assert.equal(normalizeView({ zoom: 100 }).zoom, 4);
assert.equal(rotateView({ ...DEFAULT_VIEW, yaw: 179 }, -20, 0).yaw, -175);
assert.deepEqual(rotateView(DEFAULT_VIEW, 1200, 0), DEFAULT_VIEW);
const moved = panView(DEFAULT_VIEW, 100, 50, 10, 8, 1000, 800);
assert.equal(moved.panX, -1);
assert.equal(moved.panY, 0.5);
const zoomed = zoomView(DEFAULT_VIEW, 2, 0.3, -0.2, 10, 8);
// The same projected point stays under the cursor after scaling the frustum.
assert.equal(zoomed.panX + 0.3 * 5, DEFAULT_VIEW.panX + 0.3 * 10);
assert.equal(zoomed.panY - 0.2 * 4, DEFAULT_VIEW.panY - 0.2 * 8);
assert.deepEqual(
  touchPair([
    { x: 20, y: 30 },
    { x: 60, y: 30 },
  ]),
  { x: 40, y: 30, distance: 40 },
);
console.log(
  "Camera limits, wraparound, pixel panning and cursor-anchored zoom passed.",
);
