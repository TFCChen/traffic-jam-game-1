import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createVehicleLights, createExhaustSmoke, vehicleLightPower } from './vehicleEffects.js';
const scene = new THREE.Scene();
const lighting = createVehicleLights(scene);
assert(scene.children.filter(o => o.isLight).every(o => o.shadow.needsUpdate), 'Unlit daytime lamps must initialize shadow textures before PBR rendering');
const group = new THREE.Group();
group.position.set(2, .055, 3);
const car = {
  car: {
    id: 'test',
    len: 2
  },
  group,
  velocity: 1,
  isDrag: true,
  brakeUntil: 0
};
const settings = {
  theme: 'neon',
  shadows: true
};
assert(lighting.update(car, settings, {
  decor: true
}, 100));
let lights = lighting.snapshot();
assert.equal(scene.children.length, 4, 'Fixed front/rear lights and their targets');
for (const head of lights.headlights) {
  assert(head.target[0] > head.position[0], 'Forward cone must face along the car');
  assert(head.position[0] > 3, 'Light source must clear its own bumper');
  assert(head.shadow && head.decay === 2, 'Beams must obey occlusion and inverse square falloff');
}
assert(lights.rear.target[0] < lights.rear.position[0]);
assert(lights.rear.angle > lights.headlights[0].angle);
assert(lights.rear.distance < lights.headlights[0].distance);
assert.equal(lights.rear.color, 'ef3024');
assert.equal(lighting.update(car, settings, {
  decor: true
}, 300), false, 'Static maps must be cached');
assert(lighting.update(car, settings, {
  decor: true
}, 400, true), 'Moving obstacles must invalidate shadows');
group.rotation.y = -Math.PI / 2;
assert(lighting.update(car, settings, {
  decor: true
}, 500));
lights = lighting.snapshot();
assert(lights.headlights.every(l => l.target[2] > l.position[2]), 'Vertical cars must rotate the light cone');
assert(lights.rear.target[2] < lights.rear.position[2]);
car.reversing = true;
lighting.update(car, settings, {
  decor: true
}, 600);
assert.equal(lighting.snapshot().rear.color, 'ef3024', 'Tail lights remain red while reversing');
car.braking = true;
lighting.update(car, settings, {
  decor: true
}, 700);
assert.equal(lighting.snapshot().rear.intensity, 4);
assert(vehicleLightPower('neon', true) > vehicleLightPower('sunset', true));
assert(vehicleLightPower('sunset', true) > vehicleLightPower('day', true));
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
assert.equal(scene.children.length, 0, 'Dispose must remove lights and targets');
console.log('Vehicle light direction, occlusion, falloff, red tail lamps and shadow caching passed.');
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
