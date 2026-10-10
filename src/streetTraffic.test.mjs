import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTrafficClock, createStreetTraffic, TRAFFIC_FLEET, trafficTravel, installTrafficCoverage } from './streetTraffic.js';
let seed = 83;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const clock = createTrafficClock(random), trips = new Map();
for (let frame = 0; frame < 4000; frame++) {
  const poses = clock.step(.1, true);
  assert.ok(poses.length <= 2);
  assert.equal(new Set(poses.map(pose => pose.direction)).size, poses.length, 'one car per lane');
  for (const pose of poses) {
    assert.ok(pose.opacity >= 0 && pose.opacity <= 1);
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
const coverage = { value: .25 }, opaque = new THREE.MeshStandardMaterial();
installTrafficCoverage(opaque, coverage);
const shader = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: 'void main() {\n#include <opaque_fragment>\n}' };
opaque.onBeforeCompile(shader, null);
assert.equal(opaque.transparent, false);
assert.equal(opaque.depthWrite, true, 'fading shell must still occlude cabin');
assert.equal(opaque.opacity, 1);
assert.equal(shader.uniforms.trafficCoverage, coverage);
assert.match(shader.fragmentShader, /gl_FragCoord/);
assert.match(shader.fragmentShader, /trafficWorld.z/);
assert.match(shader.fragmentShader, /discard/);
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
