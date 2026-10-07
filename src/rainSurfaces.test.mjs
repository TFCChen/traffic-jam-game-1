import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRainSurfaces,rainSurfaceKind,rainFilmMap} from './rainSurfaces.js';

const film=rainFilmMap();assert.equal(film.length,512*512*4);assert.deepEqual(film,rainFilmMap());
const count=channel=>film.filter((value,i)=>i%4===channel&&value>32).length;
assert(count(0)>1000&&count(0)<512*512*.04,'Fine beads must stay small and sparsely cover the surface');
assert(count(1)>1000&&count(1)<512*512*.08,'Thin runoff trails must leave clear spaces');
let along=0,across=0;
for(let y=1;y<511;y++)for(let x=1;x<511;x++){
  const i=(y*512+x)*4+1;if(film[i]>64){along+=film[i+512*4]>64?1:0;across+=film[i+4]>64?1:0;}
}
assert(along>across*1.3,'Runoff trails must follow gravity instead of forming round blotches');

assert.equal(rainSurfaceKind('Batched cabin'),null,'Cabin upholstery must remain dry');
assert.equal(rainSurfaceKind('Rolling wheels'),null,'Wetness must not interfere with steering shaders');
const system=createRainSurfaces();
for(const name of ['Paint red','Batched trim','Automotive glass','Courtyard foliage detail','Courtyard bark','Courtyard fence','Batched scenery']){
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
