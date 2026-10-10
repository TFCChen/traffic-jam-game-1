import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Box3,Raycaster,Vector3,Mesh,DirectionalLight,ShaderChunk,Group,OrthographicCamera} from 'three';
import {stableShadowSource,stabilizeShadowFilter} from './stableShadowFilter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {exitPose,EXIT_COMPLETE_MS} from './exitChoreography.js';
import {vegetationShadowProxy,configureCourtyardSunShadow,fitCourtyardExitShadow} from './environmentShadows.js';
import {extendStreetRoad} from './streetApproaches.js';
import {createStreetBlocks} from './streetBlocks.js';
import {passageTrafficRoute,vehicleHiddenInPassage,STREET,streetRainExposure} from './streetLayout.js';
import {createWheelShadowGeometry,batchColoredMeshes} from './garageMaterials.js';
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

const {sceneryTile,sceneryAtlasData}=await import('./sceneryAtlas.js');
for(const [name,tile]of [['Oiled oak',0],['Limestone paver 0',1],['Graphite powdercoat',3],['Cafe brick 0',4],['Linen canvas',5],['Mulched earth',6]])assert.equal(sceneryTile(name),tile,'Authored material families must not share the same generic tile');
const atlas=sceneryAtlasData();assert.equal(atlas.length,1024*512*4);assert.deepEqual(atlas,sceneryAtlasData(),'Scenery detail must remain stable across reloads');
assert(atlas.every((v,i)=>i%4!==3||v===255),'Scenery surfaces must remain opaque');

// Incremental facade detail must face the back observer, not remain a plain box.
const backFace=new Raycaster(new Vector3(-2.12,.58,1.14),new Vector3(1,0,0)).intersectObject(scene,true)[0];
assert(backFace?.object.material.name.startsWith('Cafe brick'),'The cafe back must have authored masonry');
const soilHit=new Raycaster(new Vector3(-.68,2,5.6),new Vector3(0,-1,0)).intersectObject(scene,true).find(h=>h.object.material.name==='Mulched earth');
const lipHit=new Raycaster(new Vector3(-.46,2,5.6),new Vector3(0,-1,0)).intersectObject(scene,true).find(h=>h.object.material.name==='Honed warm limestone');
assert(soilHit&&lipHit&&soilHit.point.y<lipHit.point.y-.01,'Soil must sit inside the planter instead of above its lip');

assert(!new Raycaster(new Vector3(-.68,2,5.6),new Vector3(0,-1,0)).intersectObject(scene,true).some(h=>h.object.material.name==='Honed warm limestone'&&h.point.y>soilHit.point.y),'The planting cavity must be genuinely open');

const extended=scene.clone(true),originalStreet=asphalt.find(mesh=>mesh.material.name==='Street asphalt');
const originalPositions=originalStreet.geometry.attributes.position.array.slice();
const approaches=extendStreetRoad(extended);
extended.updateMatrixWorld(true);
let continuousRoads=0;
extended.traverse(mesh=>{if(mesh.isMesh&&mesh.material.name==='Street asphalt')continuousRoads++;});
assert.equal(continuousRoads,1,'A single road receiver prevents overlapping seams');
assert.deepEqual(originalStreet.geometry.attributes.position.array,originalPositions,'Shared source geometry stays untouched');
const roadMesh=extended.getObjectByName('Continuous neighbourhood street');
const roadBounds=new Box3().setFromObject(roadMesh);
assert(Math.abs(roadBounds.max.y-.0355)<.0001,'New and original street keep the same height');
assert(Math.abs(roadBounds.max.z-roadBounds.min.z-25.4)<.001,'Finite street terminates inside both buildings');
const curbBounds=new Box3().setFromObject(extended.getObjectByName('Matching continuous stone curbs'));
assert(curbBounds.min.z<-8&&curbBounds.max.z>16,'Both kerb lines continue into the passages');
for(const height of [4.6,9,10])for(let angle=-180;angle<=180;angle+=30) {
  const a=angle*Math.PI/180;
  sun.position.set(3+Math.sin(a)*9.5,height,3+Math.cos(a)*9.5);
  fitCourtyardExitShadow(sun);
  const c=sun.shadow.camera;
  for(const x of [6.08,10.51])for(const y of [0,2.2])for(const z of [STREET.min,STREET.max]) {
    const point=new Vector3(x,y,z).project(c);
    assert(Math.abs(point.x)<1&&Math.abs(point.y)<1&&Math.abs(point.z)<1,'All building casters fit the complete sun volume, including low sunset angles');
  }
  for(let age=1800;age<3850;age+=75) {
    const pose=exitPose(age);
    for(const dx of [-1.1,1.1])for(const dz of [-1.1,1.1]) {
      const point=new Vector3(pose.x+dx,.8,pose.z+dz).applyMatrix4(c.matrixWorldInverse);
      assert(point.x>c.left&&point.x<c.right&&point.y>c.bottom&&point.y<c.top,'Exit silhouette cannot cross the sun map edge');
    }
  }
}
const stoneBatch=batchColoredMeshes(extended,mesh=>['Honed warm limestone','Basalt foundation'].includes(mesh.material.name));
assert(stoneBatch?.geometry.index,'New curbs must remain compatible with the existing scenery batching');
stoneBatch.geometry.dispose();stoneBatch.material.dispose();
approaches.forEach(geometry=>geometry.dispose());

// Test the actual renderable shell, not just the visibility helper's boxes.
const buildings=new Group(),blocks=createStreetBlocks(buildings);
buildings.traverse(mesh=>{if(mesh.isMesh)mesh.raycast=Mesh.prototype.raycast;});
buildings.updateMatrixWorld(true);
// Orbiting exposed coincident dark road and pale plinth faces on each back.
// The tunnel must be the sole owner of its visible foundation face.
const foundationScene=scene.clone(true),foundationParts=extendStreetRoad(foundationScene);
foundationScene.add(buildings);
foundationScene.traverse(mesh=>{if(mesh.isMesh)mesh.raycast=Mesh.prototype.raycast;});
foundationScene.updateMatrixWorld(true);
for(const [z,sign]of [[STREET.min,-1],[STREET.max,1]])for(const x of [7,8.3,9.6]) {
  const hits=new Raycaster(new Vector3(x,-.24,z+sign),new Vector3(0,0,-sign)).intersectObject(foundationScene,true);
  assert(hits.length,'Tunnel rear plinth is supported');
  const coincident=new Set(hits.filter(hit=>Math.abs(hit.distance-hits[0].distance)<.0001).map(hit=>hit.object));
  assert.equal(coincident.size,1,'No competing road and tunnel faces at the visible rear foundation');
}
foundationParts.forEach(g=>g.dispose());
const shell=buildings.children.filter(mesh=>mesh.name==='Street tunnel');
for(let pitch=30;pitch<=90;pitch+=15)for(let yaw=-180;yaw<180;yaw+=15) {
  const p=pitch*Math.PI/180,a=yaw*Math.PI/180,camera=new OrthographicCamera(-12,12,9,-9,.1,400);
  camera.position.set(3+200*Math.sin(a)*Math.cos(p),200*Math.sin(p),3+200*Math.cos(a)*Math.cos(p));
  camera.up.set(-Math.sin(a)*Math.sin(p),Math.cos(p),-Math.cos(a)*Math.sin(p));
  camera.lookAt(3,0,3);camera.updateMatrixWorld(true);
  const toEye=camera.getWorldDirection(new Vector3()).negate();
  for(const x of [7.35,9.25])for(const length of [2,3]) {
    const route=passageTrafficRoute(camera,x,length);assert(route,'Every supported viewing direction has concealed endpoints');
    for(const z of [route.min,route.max])for(const dx of [-.64,.64])for(const dz of [-length/2-.2,length/2+.2])for(const y of [.02,1.4]) {
      const ray=new Raycaster(new Vector3(x+dx,y,z+dz).addScaledVector(toEye,200),toEye.clone().negate(),0,200);
      assert(ray.intersectObjects(shell).length,'Real opaque shell occludes the whole vehicle, including mirrors and ground shadow');
    }
    assert.equal(vehicleHiddenInPassage(camera,x,4,length),false,'Open street remains visible');
  }
}
assert.equal(streetRainExposure(4),1);assert.equal(streetRainExposure(STREET.min+1),0);assert.equal(streetRainExposure(STREET.max-1),0);
blocks.setTheme({theme:'neon'},{decor:true});assert.equal(buildings.children.filter(o=>o.isPointLight&&o.visible).length,2);
blocks.setTheme({theme:'day'},{decor:true});assert.equal(buildings.children.filter(o=>o.isPointLight&&o.visible).length,0);
blocks.setTheme({theme:'neon'},{decor:false});assert.equal(buildings.children.filter(o=>o.isPointLight&&o.visible).length,0);
blocks.geometries.forEach(g=>g.dispose());buildings.traverse(mesh=>mesh.material?.dispose());
