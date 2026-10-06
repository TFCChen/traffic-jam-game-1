import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Box3,Raycaster,Vector3,Mesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {exitPose,EXIT_COMPLETE_MS} from './exitChoreography.js';
import {vegetationShadowProxy} from './environmentShadows.js';
import {createWheelShadowGeometry} from './garageMaterials.js';
const bytes=fs.readFileSync(new URL('../public/models/garage.glb',import.meta.url));
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.updateMatrixWorld(true);
const bounds=new Box3().setFromObject(scene),size=bounds.getSize(new Vector3());
assert(Math.abs(size.x-size.z)<.1,'Courtyard must have a square footprint');
assert(size.x>12&&size.x<12.6,'Scene is a complete expanded block');
const materials=new Set();scene.traverse(o=>{if(o.isMesh)materials.add(o.material.name);});
for(const name of ['Graphite powdercoat','Satin brass accents','Architectural glazing','Oiled oak','Cafe brick 0','Courtyard foliage detail'])assert(materials.has(name),`Detail material exported: ${name}`);
const asphalt=[];scene.traverse(o=>{if(o.isMesh&&['Asphalt blue slate','Street asphalt'].includes(o.material.name))asphalt.push(o);});
const ground=(x,z)=>new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0)).intersectObjects(asphalt)[0];
for(let row=0;row<6;row++)for(let col=0;col<6;col++)assert(Math.abs(ground(col+.5,row+.5)?.point.y-.0355)<.003,'Puzzle surface maintains original vehicle datum');
for(let age=0;age<=EXIT_COMPLETE_MS;age+=20){const p=exitPose(age);assert(Math.abs(ground(p.x,p.z)?.point.y-.0355)<.003,'Exit route has continuous asphalt support');}
const hidden=exitPose(5700);
assert(!hidden.visible);
for(const dx of [-.44,.44])for(const dz of [-1,1]){
  const hit=new Raycaster(new Vector3(hidden.x+dx,2,hidden.z+dz),new Vector3(0,-1,0)).intersectObject(scene,true)[0];
  // Before removal the complete vehicle footprint is covered, except its front
  // which has already passed through the far end into the adjoining street.
  if(hidden.z+dz<10.14)assert(hit?.point.y>1,'Street passage hides the departing car naturally');
}
assert(bytes.length<5_000_000,'Environment retains a bounded download size');
let foliage;scene.traverse(o=>{if(o.isMesh&&o.material.name==='Courtyard foliage detail')foliage=o;});
const proxy=vegetationShadowProxy(foliage);
assert(proxy.castShadow&&proxy.material.colorWrite===false&&proxy.material.depthWrite===false,'Shadow proxy cannot cover visible artwork');
assert(proxy.count*proxy.geometry.index.count<foliage.geometry.index.count*.2,'Canopy shadow geometry stays below one fifth of detailed leaf geometry');
proxy.dispose();proxy.geometry.dispose();proxy.material.dispose();
for(const length of [2,3]){
  const tyre=new Mesh(createWheelShadowGeometry(length));
  assert(tyre.geometry.index.count/3<=400,'Tyre shadows retain only the circular silhouette');
  const box=new Box3().setFromObject(tyre),pivots=tyre.geometry.attributes.wheelPivot;
  assert(Math.abs(box.min.y)<1e-6&&Math.abs(box.max.y-.38)<1e-6,'Shadow tyres touch the same ground as visible wheels');
  for(let i=0;i<pivots.count;i++)assert(Math.abs(Math.abs(pivots.getZ(i))-.43)<1e-6,'Shadow and visual wheels share steering hubs');
  tyre.geometry.dispose();tyre.material.dispose();
}
console.log('Square street courtyard, authored detail materials, unchanged puzzle surface and continuous exit support passed.');
