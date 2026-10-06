import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createVehicleLights, createExhaustSmoke, collectLampAnchors, vehicleLampState, vehicleLightPower } from './vehicleEffects.js';
const scene = new THREE.Scene(),
  lighting = createVehicleLights(scene),
  group = new THREE.Group();
assert(scene.children.filter(o => o.isLight && o.castShadow).every(o => o.shadow.needsUpdate), 'Unlit headlight depth samplers must initialize');
const headMaterial = new THREE.MeshStandardMaterial();
headMaterial.name = 'Headlamp';
const tailMaterial = new THREE.MeshStandardMaterial();
tailMaterial.name = 'Tail lamp';
const geometry = new THREE.BoxGeometry(.02, .04, .10);
const merge = (positions, material) => {
  const parts = positions.map(([x, y, z]) => geometry.clone().translate(x, y, z));
  const merged = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  const mesh = new THREE.Mesh(merged, material);
  group.add(mesh);
  return mesh;
};
const front = merge([[.82, .36, -.3], [.82, .36, .3], [0, .8, 0]], headMaterial);
const back = merge([[-.91, .36, -.3], [-.91, .36, .3], [-.1, .45, .15]], tailMaterial);
const anchors = collectLampAnchors(group, 2);
assert(anchors.head.every(Boolean) && anchors.tail.every(Boolean));
assert(anchors.head.every(a => a.mesh === front && a.point.y < .5), 'Batched roof sign cannot become a headlight source');
assert(anchors.tail.every(a => a.mesh === back && a.point.x < -.9), 'Interior red buckles cannot become tail light sources');
group.position.set(2, .055, 3);
const car = {
  car: {
    id: 'test',
    len: 2
  },
  group,
  lightAnchors: anchors,
  velocity: 1,
  isDrag: true,
  brakeUntil: 0,
  lightUntil: 1600
};
const settings = {
  theme: 'neon',
  shadows: true
};
assert(lighting.update(car, settings, {
  decor: true
}, 100));
let lights = lighting.snapshot();
assert.equal(scene.children.filter(o => o.isLight).length, 4);
assert.equal(scene.children.filter(o => o.isLight && o.castShadow).length, 2, 'Only two depth maps in the fixed pool');
assert.equal(lights.headlights.length, 2);
assert.equal(lights.taillights.length, 2);
for (let i = 0; i < 2; i++) {
  const head = lights.headlights[i],
    origin = anchors.head[i].mesh.localToWorld(anchors.head[i].point.clone());
  origin.x += .012;
  assert(new THREE.Vector3(...head.position).distanceTo(origin) < 1e-8, 'Beam starts at the actual lens');
  assert(head.target[0] > head.position[0]);
  assert(head.shadow && head.decay === 2);
}
assert(lights.headlights[0].position[2] < lights.headlights[1].position[2], 'Two distinct exterior lenses');
assert(lights.rear.target[0] < lights.rear.position[0]);
assert(lights.rear.angle > lights.headlights[0].angle && lights.rear.distance < lights.headlights[0].distance);
assert.equal(lights.rear.color, 'ef3024');
assert.equal(lighting.update(car, settings, {
  decor: true
}, 300), false, 'Static shadows cached');
assert(lighting.update(car, settings, {
  decor: true
}, 400, true), 'Obstacle movement invalidates shadows');
group.rotation.y = -Math.PI / 2;
assert(lighting.update(car, settings, {
  decor: true
}, 500));
lights = lighting.snapshot();
assert(lights.headlights.every(l => l.target[2] > l.position[2]));
assert(lights.rear.target[2] < lights.rear.position[2]);
car.reversing = true;
lighting.update(car, settings, {
  decor: true
}, 600);
assert.equal(lighting.snapshot().rear.color, 'eef4ff', 'Dedicated reversing spill is white');
car.braking = true;
lighting.update(car, settings, {
  decor: true
}, 700);
assert.equal(lighting.snapshot().rear.color, 'eef4ff', 'Reversing light remains white while brake lenses illuminate red');
car.reversing = false;
lighting.update(car, settings, {
  decor: true
}, 710);
assert.equal(lighting.snapshot().rear.color, 'ef3024');
assert.equal(lighting.snapshot().rear.intensity, 2);
const off = {
  isDrag: false,
  velocity: 0,
  lightUntil: 0
};
for (const theme of ['day', 'sunset', 'neon']) assert.deepEqual(vehicleLampState(off, theme, 2000), {
  head: 0,
  park: 0,
  brake: 0,
  reverse: 0,
  activity: 0
});
assert.equal(vehicleLampState(car, 'day', 700).head, 0);
assert.equal(vehicleLampState(car, 'day', 700).park, 0);
assert(vehicleLampState(car, 'neon', 700).park < vehicleLampState(car, 'neon', 700).brake);
const parked = {
  isDrag: false,
  velocity: 0,
  lightUntil: 1600
};
assert.equal(vehicleLampState(parked, 'neon', 1200).head, 2 / 3);
assert.equal(vehicleLampState(parked, 'neon', 1700).head, 0);
assert(vehicleLightPower('neon', true) > vehicleLightPower('sunset', true));
assert.equal(vehicleLightPower('day', true), 0);
lighting.update(car, settings, {
  decor: false
}, 800);
assert(lighting.snapshot().headlights.every(l => l.intensity === 0));
assert.equal(lighting.snapshot().rear.intensity, 0);
lighting.update(null, settings, {
  decor: true
}, 900);
assert.equal(lighting.snapshot().owner, null);
lighting.dispose();
assert.equal(scene.children.length, 0);
geometry.dispose();
front.geometry.dispose();
back.geometry.dispose();
headMaterial.dispose();
tailMaterial.dispose();
console.log('Lens-bound head/tail pairs, day/night/brake/reverse/idle timing and bounded cached shadow maps passed.');
const smoke = createExhaustSmoke(scene, 3, new THREE.Texture());
const outlet = new THREE.Vector3(0, .16, 0),
  direction = new THREE.Vector3(-1, 0, 0);
const camera = new THREE.PerspectiveCamera();
assert(smoke.emit(outlet, direction));
smoke.update(.2, 200, camera, true, 'day');
const puff = scene.children[0],
  first = new THREE.Matrix4();
puff.getMatrixAt(0, first);
const p = new THREE.Vector3(),
  q = new THREE.Quaternion(),
  scale = new THREE.Vector3();
first.decompose(p, q, scale);
assert(p.x < outlet.x && p.y > outlet.y, 'Smoke must leave the outlet and rise');
const initialSize = scale.x;
smoke.update(.5, 700, camera, true, 'day');
puff.getMatrixAt(0, first);
first.decompose(p, q, scale);
assert(scale.x > initialSize, 'Puffs expand during their lifetime');
assert(smoke.emit(outlet, direction));
assert(smoke.emit(outlet, direction));
assert.equal(smoke.emit(outlet, direction), false, 'Pool capacity remains bounded');
assert.equal(smoke.snapshot().drawCalls, 1, 'All puffs share one draw call');
smoke.update(3, 3700, camera, true, 'day');
assert.equal(smoke.snapshot().active, 0, 'Exhaust must fade and expire');
assert(smoke.emit(outlet, direction), 'Expired particles are reused');
smoke.update(.1, 3800, camera, false, 'day');
assert.equal(smoke.snapshot().active, 0);
assert.equal(smoke.snapshot().drawCalls, 0);
smoke.dispose();
assert.equal(scene.children.length, 0);
console.log('Exhaust rises, expands, expires and reuses a bounded single-draw particle pool.');
