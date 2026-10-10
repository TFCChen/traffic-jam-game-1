import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCourtyardReflections } from './courtyardReflections.js';
import { SCENE_THEMES } from './sceneThemes.js';
// Replace GPU capture only; exercise ownership, cache bounds and lighting setup.
const capture=THREE.PMREMGenerator.prototype.fromScene, targets=[];
THREE.PMREMGenerator.prototype.fromScene=function(scene,sigma,near,far,options){
  assert.equal(options.size,128);assert.equal(sigma,0);
  const sun=scene.children.find(child=>child.isDirectionalLight);
  const target={texture:{sun:sun.color.getHexString(),intensity:sun.intensity},disposed:false,
    dispose(){this.disposed=true;}};
  targets.push(target);return target;
};
const root=new THREE.Group(), geometry=new THREE.BoxGeometry(), material=new THREE.MeshStandardMaterial({color:'#d05030'});
root.add(new THREE.Mesh(geometry,material));
let geometryDisposed=false,materialDisposed=false;
geometry.addEventListener('dispose',()=>geometryDisposed=true);material.addEventListener('dispose',()=>materialDisposed=true);
let reflections;
try{
  reflections=createCourtyardReflections({},root);
  const position=new THREE.Vector3(0,9,8),day=SCENE_THEMES[0];
  const first=reflections.update(day,position,3);
  for(let i=0;i<100;i++)assert.equal(reflections.update(day,position,3),first);
  assert.equal(reflections.snapshot().builds,1,'Repeated camera/resize requests reuse the probe');
  const night=reflections.update(SCENE_THEMES[3],position,.78);
  assert.notEqual(first.sun,night.sun);assert.equal(night.intensity,.78);
  for(let i=1;i<=5;i++)reflections.update(day,position,i);
  assert.equal(reflections.snapshot().cached,4);assert(targets[0].disposed,'Evicted GPU target is disposed');
  assert.equal(material.color.getHexString(),'d05030');
  reflections.dispose();reflections=null;
  assert(targets.every(target=>target.disposed));
  assert(!geometryDisposed&&!materialDisposed,'Shared asset geometry/materials survive probe disposal');
}finally{reflections?.dispose();THREE.PMREMGenerator.prototype.fromScene=capture;geometry.dispose();material.dispose();}
console.log('Courtyard probe reuse, theme lighting, bounded memory and shared asset ownership passed.');
