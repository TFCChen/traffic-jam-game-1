import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRainSurfaces,rainSurfaceKind} from './rainSurfaces.js';

assert.equal(rainSurfaceKind('Batched cabin'),null,'Cabin upholstery must remain dry');
assert.equal(rainSurfaceKind('Rolling wheels'),null,'Wetness must not interfere with steering shaders');
const system=createRainSurfaces();
for(const name of ['Paint red','Automotive glass','Courtyard foliage detail','Courtyard bark','Courtyard fence','Batched scenery']){
  const material=new THREE.MeshPhysicalMaterial();material.name=name;
  material.onBeforeCompile=s=>{s.fragmentShader+='\n// preserved optical/finish logic';};
  system.attach(material);const first=material.onBeforeCompile;system.attach(material);
  assert.equal(material.onBeforeCompile,first,'Registration must not stack wrappers');
  const shader={vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader,uniforms:{}};
  material.onBeforeCompile(shader);
  assert(shader.fragmentShader.includes('preserved optical/finish logic'));
  assert(shader.vertexShader.includes('rainLocal=transformed'));
  assert(shader.fragmentShader.includes('rainPerturb'));
  system.setTheme({theme:'rain'},{decor:true});assert.equal(shader.uniforms.rainSurfaceWet.value,1);
  system.setTheme({theme:'day'},{decor:true});assert.equal(shader.uniforms.rainSurfaceWet.value,0);
  system.setTheme({theme:'rain'},{decor:false});assert.equal(shader.uniforms.rainSurfaceDetail.value,0);
  system.detach(material);assert.equal(system.snapshot().materials,0);
  material.dispose();
}
system.dispose();
console.log('Exterior-only local droplets, preserved optics, dry restoration, saver detail and material lifecycle passed');
