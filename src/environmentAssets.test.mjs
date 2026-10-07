import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Box3,Raycaster,Vector3,Mesh,DirectionalLight,ShaderChunk} from 'three';
import {stableShadowSource,stabilizeShadowFilter} from './stableShadowFilter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {exitPose,EXIT_COMPLETE_MS} from './exitChoreography.js';
import {vegetationShadowProxy,configureCourtyardSunShadow} from './environmentShadows.js';
import {createWheelShadowGeometry} from './garageMaterials.js';
const bytes=fs.readFileSync(new URL('../public/models/garage.glb',import.meta.url));
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.updateMatrixWorld(true);
const bounds=new Box3().setFromObject(scene),size=bounds.getSize(new Vector3());
assert(Math.abs(size.x-size.z)<.1,'Courtyard must have a square footprint');
assert(size.x>12&&size.x<12.6,'Scene is a complete expanded block');
// The only exposed perimeter datum must be stone. Previously the dark slab
// and light reveal both had top faces at zero, competing in the depth buffer.
for(let t=.3;t<5.9;t+=.2)for(const [x,z]of [[-.08,t],[6.08,t],[t,-.08],[t,6.08]]){
  const hits=new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0)).intersectObject(scene,true);
  const top=hits.find(h=>h.object.material.name==='Honed warm limestone');
  const slab=hits.find(h=>h.object.material.name==='Basalt foundation');
  assert(top&&slab,'Both perimeter structural layers remain present');
  assert(top.point.y-slab.point.y>.04,'Visible stone and dark foundation cannot be coplanar anywhere on the four lot edges');
}
const sun=new DirectionalLight();configureCourtyardSunShadow(sun.shadow);
sun.target.position.set(3,.15,3);sun.target.updateMatrixWorld(true);
for(let angle=-180;angle<=180;angle+=15){
  const radians=angle*Math.PI/180;
  sun.position.set(3+Math.sin(radians)*8,10,3+Math.cos(radians)*8);sun.updateMatrixWorld(true);sun.shadow.updateMatrices(sun);
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const point=new Vector3(x,y,z).applyMatrix4(sun.shadow.camera.matrixWorldInverse);
    assert(-point.z>sun.shadow.camera.near&&-point.z<sun.shadow.camera.far,'Sun depth range covers courtyard at every lighting angle');
  }
}
assert(sun.shadow.bias<=0&&Math.abs(sun.shadow.bias)*(sun.shadow.camera.far-sun.shadow.camera.near)<.005,'Receiver depth moves toward the light without detaching small fence shadows');
const originalPCF=ShaderChunk.shadowmap_pars_fragment;
stabilizeShadowFilter();const stablePCF=ShaderChunk.shadowmap_pars_fragment;
assert(!stablePCF.includes('interleavedGradientNoise( gl_FragCoord.xy )'),'PCF sampling cannot depend on the pixel where a world shadow is displayed');
assert.equal((stablePCF.match(/texture\( shadowMap/g)??[]).length,(originalPCF.match(/texture\( shadowMap/g)??[]).length,'Stable shadows retain the original texture fetch budget');
stabilizeShadowFilter();assert.equal(ShaderChunk.shadowmap_pars_fragment,stablePCF,'Initialization is safe when multiple garage instances mount');
assert.throws(()=>stableShadowSource('changed upstream shader'),'Three upgrades must explicitly review the filter patch');
let cornerTriangles=0;
scene.traverse(o=>{
  if(!o.isMesh||!o.material.name.startsWith('Fence '))return;
  const seen=new Set(),position=o.geometry.attributes.position,index=o.geometry.index;
  for(let i=0;i<index.count;i+=3){
    const points=[0,1,2].map(j=>new Vector3().fromBufferAttribute(position,index.getX(i+j)).applyMatrix4(o.matrixWorld));
    if(!points.every(p=>p.y>-.05&&p.y<.4&&Math.min(Math.abs(p.x),Math.abs(p.x-6))<.05&&Math.min(Math.abs(p.z),Math.abs(p.z-6))<.05))continue;
    const key=points.map(p=>p.toArray().map(n=>n.toFixed(5)).join(',')).sort().join('|');
    assert(!seen.has(key),'Fence corners must not contain duplicate coplanar faces');seen.add(key);cornerTriangles++;
  }
});
assert(cornerTriangles>0,'Corner geometry regression check examines the authored fence');
const materials=new Set();scene.traverse(o=>{if(o.isMesh)materials.add(o.material.name);});
for(const name of ['Graphite powdercoat','Satin brass accents','Architectural glazing','Oiled oak','Cafe brick 0','Courtyard foliage detail','Fence graphite powdercoat','Fence limestone footings','Fence brass caps'])assert(materials.has(name),`Detail material exported: ${name}`);
const asphalt=[];scene.traverse(o=>{if(o.isMesh&&['Asphalt blue slate','Street asphalt'].includes(o.material.name))asphalt.push(o);});
const ground=(x,z)=>new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0)).intersectObjects(asphalt)[0];
for(let row=0;row<6;row++)for(let col=0;col<6;col++)assert(Math.abs(ground(col+.5,row+.5)?.point.y-.0355)<.003,'Puzzle surface maintains original vehicle datum');
for(let age=0;age<=EXIT_COMPLETE_MS;age+=20){const p=exitPose(age);assert(Math.abs(ground(p.x,p.z)?.point.y-.0355)<.003,'Exit route has continuous asphalt support');}
for(const x of [8.70,9.30,9.90])for(const z of [8.3,9.2,10]){
  const hit=new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0)).intersectObject(scene,true)[0];
  assert(hit?.point.y<.08,'Street end remains open, without a building hiding the car');
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
