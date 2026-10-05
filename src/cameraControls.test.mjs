import assert from "node:assert/strict";
import {
  DEFAULT_VIEW,
  ORTHOGRAPHIC_DISTANCE,
  ORTHOGRAPHIC_FAR,
  normalizeView,
  rotateView,
  panView,
  zoomView,
  touchPair,
} from "./cameraControls.js";
import { OrthographicCamera, Vector3 } from "three";
// Regression: panning the orbit target toward the viewer put the lot behind
// the old 14-unit camera's near plane, slicing it along a horizontal line.
for (const pitch of [30, 45, 60, 80])
  for (let yaw = -180; yaw < 180; yaw += 30)
    for (const fx of [-32, 0, 32])
      for (const fz of [-32, 0, 32]) {
        const camera = new OrthographicCamera(-5, 5, 4, -4, .1, ORTHOGRAPHIC_FAR);
        const p = pitch * Math.PI / 180, y = yaw * Math.PI / 180;
        const target = new Vector3(3 + fx, .15, 3 + fz);
        camera.position.copy(target).add(new Vector3(Math.sin(y)*Math.cos(p), Math.sin(p), Math.cos(y)*Math.cos(p)).multiplyScalar(ORTHOGRAPHIC_DISTANCE));
        camera.lookAt(target); camera.updateMatrixWorld();
        for (const x of [-100, 100]) for (const z of [-100, 100]) {
          const depth = -new Vector3(x, -.48, z).applyMatrix4(camera.matrixWorldInverse).z;
          assert.ok(depth > camera.near && depth < camera.far, 'Ground must stay between clipping planes at all orbit angles and stored focus limits');
        }
      }
assert.deepEqual(
  normalizeView({ pitch: NaN, yaw: Infinity, zoom: NaN, panX: Infinity }),
  DEFAULT_VIEW,
);
assert.equal(normalizeView({ pitch: -100, zoom: 100 }).pitch, 30);
assert.equal(normalizeView({ zoom: 100 }).zoom, 4);
assert.equal(rotateView({ ...DEFAULT_VIEW, yaw: 179 }, -20, 0).yaw, -175);
assert.deepEqual(rotateView(DEFAULT_VIEW, 1200, 0), DEFAULT_VIEW);
assert.ok(rotateView(DEFAULT_VIEW, 0, 20).pitch > DEFAULT_VIEW.pitch);
assert.ok(rotateView(DEFAULT_VIEW, 0, -20).pitch < DEFAULT_VIEW.pitch);
assert.equal(rotateView(DEFAULT_VIEW, 20, 0).yaw, DEFAULT_VIEW.yaw - 6);
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
