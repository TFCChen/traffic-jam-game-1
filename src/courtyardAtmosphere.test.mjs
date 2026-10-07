import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCourtyardAtmosphere, leafPose } from './courtyardAtmosphere.js';
import {dripPose,createRainMotion,rainDripSources} from './rainMotion.js';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TREE_ANCHORS} from './courtyardAtmosphere.js';

const bytes=fs.readFileSync(new URL('../public/models/garage.glb',import.meta.url));
const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const sources=rainDripSources(asset.scene,TREE_ANCHORS);
assert.equal(sources.filter(s=>s.kind==='leaf').length,4,'Each real tree must supply an attached leaf-tip source');
assert.equal(sources.filter(s=>s.kind==='canopy').length,3);
let maxActive=0;
for(let t=0;t<90;t+=.02){
  let active=0;
  for(let i=0;i<sources.length;i++){
    const source=sources[i],p=dripPose(t,i,source);
    assert(p.x<-.25||p.x>6.25||p.z<-.25||p.z>6.25,'Water effects must stay outside the puzzle');
    assert(p.y>=source.floor&&p.y<=source.y+.003,'Drops must stop at the receiving surface');
    assert(p.impactAlpha===0||p.dropAlpha===0,'A landed drop must not remain airborne');
    if(p.dropAlpha>0||p.impactAlpha>0)active++;
  }
  maxActive=Math.max(maxActive,active);
}
assert(maxActive<=3,'Residual rain must be occasional, not a continuous shower');
for(const source of sources.filter(s=>s.kind==='leaf')){
  const ray=new THREE.Raycaster(new THREE.Vector3(source.x,source.y+.05,source.z),new THREE.Vector3(0,-1,0));
  assert(ray.intersectObject(asset.scene,true).some(h=>h.object.material.name==='Courtyard foliage detail'&&Math.abs(h.point.y-source.y)<.06),
    'Leaf sources must be attached to the shipped geometry');
}
const waterScene=new THREE.Scene(),motion=createRainMotion(waterScene,asset.scene,TREE_ANCHORS);
motion.update(.1,true);const clock=motion.snapshot().time;
motion.update(20,false);assert.equal(motion.snapshot().time,clock,'Disabled effects must not simulate or accumulate time');
assert.equal(motion.snapshot().visible,false);assert.equal(motion.snapshot().active,0);
for(let i=0;i<11;i++)motion.update(.1,true);
const particleMesh=waterScene.children[0],matrix=new THREE.Matrix4(),position=new THREE.Vector3();
for(let j=0;j<3;j++){
  const index=2+j;assert(particleMesh.geometry.attributes.waterFade.getX(index)>0,'A landing drop must emit its small splash fragments');
  particleMesh.getMatrixAt(index,matrix);position.setFromMatrixPosition(matrix);
  assert(position.y>=sources[0].floor&&position.y<sources[0].floor+.08,'Splash particles must rise only a few centimetres above the receiving surface');
  assert(Math.hypot(position.x-sources[0].x,position.z-sources[0].z)<.065,'Small splashes must stay beside the impact');
}
motion.pause();motion.dispose();assert.equal(waterScene.children.length,0);

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
const barkMaterial = new THREE.MeshStandardMaterial(); barkMaterial.name = 'Courtyard bark';
const bark = new THREE.Mesh(original, barkMaterial); bark.position.copy(foliage.position); garage.add(bark);
const atmosphere = createCourtyardAtmosphere(scene, garage);
assert.equal(atmosphere.snapshot().residualDrips,false,'Runoff must start hidden until a wet frame is rendered');
atmosphere.update(.1,{theme:'rain'},{decor:true},false,false);
assert.equal(atmosphere.snapshot().residualDrips,true);
assert.notEqual(foliage.geometry, original); assert(!original.getAttribute('windProfile'));
assert.notEqual(bark.geometry, original);
assert.deepEqual(bark.geometry.getAttribute('windProfile').array, foliage.geometry.getAttribute('windProfile').array,
  'Branches and leaves at shared attachment points must receive identical wind displacement');
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
  assert.equal(atmosphere.snapshot().residualDrips,false);
}
atmosphere.setTheme({ theme: 'day' }, { decor: true }); assert.equal(atmosphere.snapshot().cafeLight, 0);
atmosphere.update(.1, {}, { decor: true }, false, false);
assert.equal(atmosphere.pause(), true); assert.equal(atmosphere.pause(), false);
assert.deepEqual(atmosphere.snapshot().wind, [0, 0, 0, 0]);
atmosphere.dispose(); assert.equal(foliage.geometry, original); assert.equal(bark.geometry, original); assert.equal(scene.children.length, 1);
original.dispose(); foliageMaterial.dispose(); barkMaterial.dispose();
console.log('Courtyard atmosphere: bounded wind, sparse sidewalk leaves, static reduced motion and resource cleanup passed');
