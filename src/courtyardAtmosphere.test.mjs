import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCourtyardAtmosphere, leafPose } from './courtyardAtmosphere.js';

for (let t = 0; t < 80; t += .05) {
  let count = 0;
  for (let i = 0; i < 8; i++) {
    const p = leafPose(t, i);
    assert(p.x < -.25 || p.x > 6.25 || p.z < -.25 || p.z > 6.25, 'Falling leaves must stay outside the puzzle');
    assert(p.y >= .117 && p.y <= 1.28 && p.alpha >= 0 && p.alpha <= 1);
    if (p.alpha > .01) count++;
  }
  assert(count <= 4, 'Ambient particles must remain sparse');
}
const landed = leafPose(5.2, 0), later = leafPose(7, 0);
assert.deepEqual([landed.x, landed.y, landed.z], [later.x, later.y, later.z], 'Settled leaves must stop sliding');
assert(leafPose(10, 0).alpha < landed.alpha);

const scene = new THREE.Scene(), garage = new THREE.Group(); scene.add(garage);
const original = new THREE.BoxGeometry(.1, .1, .1);
const foliageMaterial = new THREE.MeshStandardMaterial(); foliageMaterial.name = 'Courtyard foliage detail';
const foliage = new THREE.Mesh(original, foliageMaterial); foliage.position.set(-.7, 1.3, 5.6); garage.add(foliage);
const atmosphere = createCourtyardAtmosphere(scene, garage);
assert.notEqual(foliage.geometry, original); assert(!original.getAttribute('windProfile'));
atmosphere.setTheme({ theme: 'neon' }, { decor: true });
assert(atmosphere.snapshot().cafeLight > 0);
for (let i = 0; i < 1000; i++) {
  atmosphere.update(.1, {}, { decor: true }, false, false);
  const [x, z, flutter, y] = atmosphere.snapshot().wind;
  assert(Math.abs(x) + Math.abs(flutter) <= .02001 && Math.abs(z) + Math.abs(flutter) <= .01401 && Math.abs(y) <= .00201);
}
for (const [quality, reduced, editor] of [[{ decor: true }, true, false], [{ decor: false }, false, false], [{ decor: true }, false, true]]) {
  atmosphere.update(.1, {}, quality, reduced, editor);
  assert.deepEqual(atmosphere.snapshot().wind, [0, 0, 0, 0]); assert.equal(atmosphere.snapshot().activeLeaves, 0);
}
atmosphere.setTheme({ theme: 'day' }, { decor: true }); assert.equal(atmosphere.snapshot().cafeLight, 0);
atmosphere.update(.1, {}, { decor: true }, false, false);
assert.equal(atmosphere.pause(), true); assert.equal(atmosphere.pause(), false);
assert.deepEqual(atmosphere.snapshot().wind, [0, 0, 0, 0]);
atmosphere.dispose(); assert.equal(foliage.geometry, original); assert.equal(scene.children.length, 1);
original.dispose(); foliageMaterial.dispose();
console.log('Courtyard atmosphere: bounded wind, sparse sidewalk leaves, static reduced motion and resource cleanup passed');
