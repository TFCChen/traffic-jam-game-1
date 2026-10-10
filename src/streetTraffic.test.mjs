import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTrafficClock, createStreetTraffic, TRAFFIC_FLEET, trafficTravel, installTrafficCoverage, trafficRoute } from './streetTraffic.js';
let seed = 83;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const clock = createTrafficClock(random), trips = new Map();
for (let frame = 0; frame < 4000; frame++) {
  const poses = clock.step(.1, true);
  assert.ok(poses.length <= 2);
  assert.equal(new Set(poses.map(pose => pose.direction)).size, poses.length, 'one car per lane');
  for (const pose of poses) {
    assert.ok(pose.opacity >= 0 && pose.opacity <= 1);
    assert.equal(pose.opacity, 1, 'normal traffic never fades into view');
    assert.equal(pose.x, pose.direction < 0 ? 9.25 : 7.35);
    assert.ok(pose.duration < 5.3 && pose.duration > 3.2, 'faster than old seven-second route');
    const previous = trips.get(pose.id);
    if (previous) assert.ok((pose.z - previous.z) * pose.direction > 0);
    trips.set(pose.id, pose);
  }
}
const completed = [...trips.values()];
assert.equal(new Set(completed.map(pose => pose.model)).size, TRAFFIC_FLEET.length);
assert.equal(new Set(completed.map(pose => pose.direction)).size, 2);
for (let offset = 0; offset + 6 <= completed.length; offset += 6)
  assert.equal(new Set(completed.slice(offset, offset + 6).map(pose => pose.model)).size, 6);
assert.ok(new Set(completed.map(pose => pose.duration.toFixed(2))).size > 5);
for (const bend of [-.325, .325]) {
  assert.equal(trafficTravel(0, bend), 0);
  assert.equal(trafficTravel(1, bend), 1);
  assert.notEqual(trafficTravel(.3, bend) - trafficTravel(.2, bend), trafficTravel(.8, bend) - trafficTravel(.7, bend));
}
clock.step(.1, true, true);
assert.deepEqual(clock.step(.1, true, true), [], 'street clears in 0.18 seconds for exit');
for (let i = 0; i < 100; i++) assert.deepEqual(clock.step(.1, true, true), []);
assert.deepEqual(clock.step(.1, false), []);
const orbitClock = createTrafficClock(() => .4);
let orbitPose;
for (let i = 0; i < 31; i++) orbitPose = orbitClock.step(.1, true)[0] ?? orbitPose;
const extendedRoute = () => ({ min: -40, max: 40 });
for (let i = 0; i < 70; i++) {
  const current = orbitClock.step(.1, true, false, extendedRoute).find(pose => pose.id === orbitPose.id);
  assert.ok(current, 'zooming out extends the exit instead of removing a visible car');
  orbitPose = current;
}
const coverage = { value: .25 }, opaque = new THREE.MeshStandardMaterial();
installTrafficCoverage(opaque, coverage);
const shader = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: 'void main() {\n#include <opaque_fragment>\n}' };
opaque.onBeforeCompile(shader, null);
assert.equal(opaque.transparent, false);
assert.equal(opaque.depthWrite, true, 'fading shell must still occlude cabin');
assert.equal(opaque.opacity, 1);
assert.equal(shader.uniforms.trafficCoverage, coverage);
assert.match(shader.fragmentShader, /gl_FragCoord/);
assert.doesNotMatch(shader.fragmentShader, /trafficWorld|trafficWorld.z/, 'never slice the vehicle at a world-space boundary');
assert.match(shader.fragmentShader, /discard/);
for (const pitch of [30, 45, 90]) for (const yaw of [0, 45, 90, 180]) for (const zoom of [.65, 1, 4]) {
  const camera = new THREE.OrthographicCamera(-12 / zoom, 12 / zoom, 9 / zoom, -9 / zoom, .1, 400);
  const p = pitch * Math.PI / 180, a = yaw * Math.PI / 180;
  camera.position.set(3 + 200 * Math.sin(a) * Math.cos(p), 200 * Math.sin(p), 3 + 200 * Math.cos(a) * Math.cos(p));
  camera.up.set(-Math.sin(a)*Math.sin(p), Math.cos(p), -Math.cos(a)*Math.sin(p));
  camera.lookAt(3, 0, 3); camera.updateMatrixWorld(true);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  for (const x of [7.35, 9.25]) for (const length of [2, 3]) {
    const route = trafficRoute(camera, x, length);
    if (!route) continue;
    for (const z of [route.min, route.max]) {
      assert.equal(frustum.intersectsSphere(new THREE.Sphere(new THREE.Vector3(x, .8, z), Math.hypot(length / 2 + .25, .8, .6))), false, 'whole vehicle outside camera at both endpoints');
    }
  }
}
const scene = new THREE.Scene(), source = new THREE.Group();
const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial({ name: 'Paint body' });
source.add(new THREE.Mesh(geometry, material));
const library = Object.fromEntries(TRAFFIC_FLEET.map(spec => [spec.kind, source]));
const traffic = createStreetTraffic(scene, library, new Map(), undefined, random);
for (let i = 0; i < 40; i++) traffic.update(.1, {}, { decor: true }, false, {});
const visible = scene.children.filter(car => car.visible);
assert.equal(visible.length, 1);
visible[0].traverse(mesh => {
  if (mesh.isMesh && mesh.material.name === 'Paint body') {
    assert.equal(mesh.material.transparent, false);
    assert.equal(mesh.material.depthWrite, true);
    assert.equal(mesh.material.opacity, 1);
  }
});
assert.equal(material.transparent, false);
assert.equal(material.color.getHexString(), 'ffffff', 'source paint stays untouched');
traffic.update(.1, {}, { decor: true }, false, { editor: true });
assert.ok(scene.children.every(car => !car.visible));
traffic.dispose();
assert.equal(scene.children.length, 0);
geometry.dispose(); material.dispose(); opaque.dispose();
console.log('Traffic variety, lanes, speed profiles, coherent coverage, exit priority and ownership passed');
