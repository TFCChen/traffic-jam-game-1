import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {catPose,createCourtyardCat} from './courtyardCat.js';

const bytes=fs.readFileSync(new URL('../public/models/garage.glb',import.meta.url));
const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
asset.scene.updateMatrixWorld(true);
// Check the real shipped paving, rather than assuming a floating floor datum.
for(let t=0;t<105;t+=.1) {
  const p=catPose(t);
  assert(p.x<-.9&&p.x>-1.6&&p.z>3.1&&p.z<4.2,'Resident must stay in its sidewalk bay, away from puzzle and exit');
  const ray=new THREE.Raycaster(new THREE.Vector3(p.x,.30,p.z),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObject(asset.scene,true)[0];
  assert(hit&&hit.point.y>=.099&&hit.point.y<=.108,'Paws must use the actual paving / recessed mortar height');
  const wet=catPose(t,true);
  assert.equal(wet.hop,0);assert.equal(wet.reach,0);assert.equal(wet.z,3.48,'Rain behavior must not chase across wet paving');
}
for(const t of [32,70,105]) {
  const a=catPose(t-1e-6),b=catPose(t+1e-6);
  assert(Math.abs(a.z-b.z)<.001&&Math.abs(a.y-b.y)<.001,'Behavior loop must return home continuously');
}
const scene=new THREE.Scene(),cat=createCourtyardCat(scene);
const group=scene.getObjectByName('Sidewalk kitten resident'),mesh=scene.getObjectByName('Courtyard tabby kitten');
assert(mesh.isSkinnedMesh&&mesh.skeleton.bones.length===24);
assert.equal(mesh.geometry.groups.length,0,'Resident coat and details must share one material draw');
assert.equal(mesh.castShadow,false,'Resident must not introduce a per-frame full-scene shadow pass');
const position=new THREE.Vector3();
for(let frame=0;frame<1050;frame++) {
  cat.update(.1,{theme:'day'},{decor:true},false,false);
  group.updateMatrixWorld(true);mesh.skeleton.update();
  let minY=Infinity;
  for(let i=0;i<mesh.geometry.attributes.position.count;i++) {
    position.fromBufferAttribute(mesh.geometry.attributes.position,i);
    mesh.applyBoneTransform(i,position).applyMatrix4(mesh.matrixWorld);
    assert(Number.isFinite(position.y));
    minY=Math.min(minY,position.y);
  }
  assert(minY>.103,`Posed limbs must not sink through paving: ${minY}`);
}
const clock=cat.snapshot().time;
cat.update(20,{theme:'day'},{decor:true},true,false);assert.equal(cat.snapshot().time,clock);
cat.update(20,{theme:'day'},{decor:false},false,false);assert.equal(cat.snapshot().time,clock);
cat.update(.1,{theme:'day'},{decor:true},false,true);assert.equal(cat.snapshot().visible,false);
assert.equal(cat.snapshot().time,clock,'Editor must not simulate hidden resident');
cat.setTheme({theme:'rain'},{decor:true});assert(mesh.material.roughness>.9);
cat.dispose();assert.equal(scene.children.length,0);
console.log('Kitten sidewalk clearance, continuous behavior, skeletal ground contact, static preferences and resource cleanup passed');
