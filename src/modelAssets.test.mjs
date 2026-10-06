import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Box3,Raycaster,Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { vehicleModel } from './vehicleModels.js';
import { prepareWheels,batchColoredMeshes } from './garageMaterials.js';
import { configureVehicleGlass, prepareVehicleGlass } from './vehicleGlass.js';
import { configureVehiclePaint, vehicleTrimSurface } from './vehicleFinish.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lengths={racer:2,jeep:2,pickup:2,compact:2,taxi:2,schoolbus:3,coach:3,camper:3,delivery:3};
for(const [name,length]of Object.entries(lengths)){
  const bytes=fs.readFileSync(path.join(root,'public/models',`${name}.glb`));
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const bounds=new Box3().setFromObject(asset.scene);
  assert.ok(bounds.min.x>=-length/2-.12&&bounds.max.x<=length/2+.12,`${name}: vehicle must remain centred on its lane`);
  assert.ok(bounds.min.z>=-.54&&bounds.max.z<=.54,`${name}: vehicle must fit within one lane`);
  assert.ok(bounds.min.y>=-.001&&bounds.max.y>.5&&bounds.max.y<1.3,`${name}: GLB must use the correct up axis and rest on its tyres`);
  const glazing=[],mirrors=[],interior=[];
  asset.scene.traverse(o=>{if(o.isMesh){
    if(o.material.name==='Automotive glass')glazing.push(o);
    if(o.material.name==='Mirror silver')mirrors.push(o);
    if(o.material.name==='Cabin upholstery')interior.push(o);
  }});
  assert.ok(glazing.length&&glazing.every(o=>o.material.isMeshPhysicalMaterial&&o.material.transmission>.8&&o.material.metalness===0),`${name}: glazing must export physical transmission instead of opaque plastic`);
  for(const window of glazing){
    const count=window.geometry.index?.count??window.geometry.getAttribute('position').count;
    window.geometry=prepareVehicleGlass(window.geometry);
    assert.equal(window.geometry.getAttribute('position').count,count*2,'Thin glass must contain both visible optical faces');
  }
  for(const quality of ['high','standard','saver','high'])for(const window of glazing){
    configureVehicleGlass(window.material,quality);
    assert.equal(window.material.roughness,.003,`${name}: tint must not turn glass into a rough frosted material`);
    assert.equal(window.material.transmission,0,'Thin panes must not trigger a second opaque-scene render');
    assert.equal(window.material.userData.optics,'thin-sheet');
    assert.equal(window.material.transparent,true);
    assert.equal(window.material.depthWrite,false,'Front glass must not hide farther windows');
  }
  assert.ok(mirrors.length&&mirrors.every(o=>o.material.metalness===1),`${name}: reflective mirror lenses must survive export`);
  assert.ok(interior.length,`${name}: a visible cabin must contain actual interior geometry`);
  let leatherVertices=0;
  asset.scene.traverse(o=>{if(o.isMesh&&o.material.name==='Tailored cabin leather'){
    assert.ok(o.material.vertexColors,'Cabin palettes must use vertex colours');
    const color=o.geometry.getAttribute('color');assert.ok(color,'Leather must export its colour attributes');
    leatherVertices+=color.count;
  }});
  assert.ok(leatherVertices>100,`${name}: shaped and upholstered seat details must survive export`);
  // Feet belong below the cushion plane, inside an actual hollow body shell.
  const seatX={racer:-.25,compact:-.21,taxi:-.21,jeep:-.21,pickup:.12,delivery:.88,schoolbus:.30,coach:.98,camper:.98}[name];
  const seatZ={racer:.365,compact:.415,taxi:.415,jeep:.46,pickup:.46,delivery:.64,schoolbus:.54,coach:.54,camper:.54}[name];
  asset.scene.updateMatrixWorld(true);
  const pillarX={racer:-.34,compact:-.23,taxi:-.23,jeep:-.23,pickup:-.12,camper:.78}[name];
  if(pillarX!==undefined){
    const h={racer:.49,compact:.56,taxi:.56,jeep:.62,pickup:.63,camper:.75}[name];
    const hit=new Raycaster(new Vector3(pillarX,h,2),new Vector3(0,0,-1)).intersectObject(asset.scene,true)[0];
    assert.ok(hit&&hit.object.material.name!=='Automotive glass',`${name}: B pillar must visibly occupy the gap between separate side panes`);
  }
  if(name==='coach'||name==='schoolbus'){
    const x=name==='coach'?.70:.56;
    const panel=new Raycaster(new Vector3(x+.07,.40,2),new Vector3(0,0,-1)).intersectObject(asset.scene,true)[0];
    assert.ok(panel?.object.material.name.startsWith('Paint'),`${name}: passenger door needs a solid lower kick panel`);
    const innerWall=new Raycaster(new Vector3(x+.07,.66,.40),new Vector3(0,0,-1)).intersectObject(asset.scene,true)[0];
    assert.ok(!innerWall||innerWall.point.z<.34||!innerWall.object.material.name.startsWith('Paint'),`${name}: door glazing must expose a carved entrance instead of intact exterior bodywork`);
  }
  const footwell=new Raycaster(new Vector3(seatX+.16,seatZ-.01,name==='racer'||['compact','taxi','jeep','pickup'].includes(name)?-.145:-.18),new Vector3(0,-1,0)).intersectObject(asset.scene,true)[0];
  assert.ok(footwell&&['Tyre rubber','Cabin upholstery','Seat stitching and console'].includes(footwell.object.material.name),`${name}: the footwell must expose carpet or a floor mat, not solid exterior coachwork`);
  assert.ok(footwell.point.y<seatZ-.09&&footwell.point.y>seatZ-.17,`${name}: feet need a recessed floor beneath the seat cushion`);
  if(['coach','schoolbus','delivery'].includes(name)){
    asset.scene.updateMatrixWorld(true);
    const windshield=new Raycaster(new Vector3(2,.70,0),new Vector3(-1,0,0)).intersectObject(asset.scene,true)[0];
    assert.equal(windshield?.object.material.name,'Automotive glass',`${name}: front glass must be exposed above the solid shell`);
    const opaque=[];asset.scene.traverse(o=>{if(o.isMesh&&o.material.name!=='Automotive glass')opaque.push(o);});
    const interiorX=name==='delivery'?.88:name==='schoolbus'?-.40:-.34;
    const interior=new Raycaster(new Vector3(interiorX,name==='delivery'?.63:.735,2),new Vector3(0,0,-1)).intersectObjects(opaque,true)[0];
    assert.ok(['Cabin upholstery','Tailored cabin leather'].includes(interior?.object.material.name),`${name}: side glazing must expose actual seats through the shell`);
    if(name==='coach'){
      const route=new Raycaster(new Vector3(2,.925,.04),new Vector3(-1,0,0)).intersectObject(asset.scene,true)[0];
      assert.equal(route?.object.material.name,'Headlamp','Coach route pixels must remain in front of the destination housing');
    }
    for(const x of [-1.17,1.16])for(const z of [-.36,.36]){
      const hit=new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0)).intersectObject(asset.scene,true)[0];
      assert.ok(hit?.point.y>.4&&!['Rolling wheels','Tyre rubber'].includes(hit.object.material.name),`${name}: wheel openings must retain body above the tyres`);
    }
  }
  if(['racer','compact','jeep'].includes(name)){
    asset.scene.updateMatrixWorld(true);
    const paint=[];asset.scene.traverse(o=>{if(o.isMesh&&o.material.name.startsWith('Paint'))paint.push(o);});
    for(const x of [.49,.66,.79]){
      const heights=[-.25,0,.25].map(z=>new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0)).intersectObjects(paint,true)[0]?.point.y);
      assert.ok(heights.every(Number.isFinite),`${name}: continuous bonnet across its width`);
      assert.ok(heights[1]>=Math.max(heights[0],heights[2])-.006,`${name}: bonnet centre must not sink between raised fenders`);
    }
  }
  if(name==='compact'||name==='jeep'){
    asset.scene.updateMatrixWorld(true);
    for(const x of [.45,.65,.85]){
      const hit=new Raycaster(new Vector3(x,2,0),new Vector3(0,-1,0)).intersectObject(asset.scene,true)[0];
      assert.ok(hit?.object.material.name.startsWith('Paint')&&hit.point.y>.3,`${name}: wheel cuts must leave the bonnet intact`);
    }
    for(const x of [-.67,.66])for(const z of [-.40,-.30,.30,.40]){
      const hit=new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0)).intersectObject(asset.scene,true)[0];
      assert.ok(hit?.object.material.name.startsWith('Paint')&&hit.point.y>.38,`${name}: fenders must cover the tyre crown`);
    }
    assert.ok(name==='jeep'?bounds.max.y>.82:bounds.max.y>.70&&bounds.max.y<.76,`${name}: distinct roof silhouette must survive export`);
  }
  if(name==='racer'){
    asset.scene.updateMatrixWorld(true);
    for(const side of [-1,1]) {
      const outerFender=new Raycaster(new Vector3(.82,2,side*.37),new Vector3(0,-1,0)).intersectObject(asset.scene,true)[0];
      assert.ok(outerFender?.object.material.name.startsWith('Paint'),'Recessed wheel liners must not protrude through the front fender');
    }
    for(const mirror of mirrors){
      const p=mirror.geometry.getAttribute('position');
      for(let i=0;i<p.count;i++)assert.ok(Math.abs(new Vector3().fromBufferAttribute(p,i).applyMatrix4(mirror.matrixWorld).z)>.38,'Coupe mirror lenses must sit outside the cabin glazing.');
    }
    const seat=new Raycaster(new Vector3(-.355,.43,1),new Vector3(0,0,-1)).intersectObjects(interior,true)[0];
    assert.ok(seat,'Coupe side window must expose a real seat back at passenger eye level.');
    for(const x of [.45,.65,.85]){
      const hit=new Raycaster(new Vector3(x,2,0),new Vector3(0,-1,0)).intersectObject(asset.scene,true)[0];
      assert.ok(hit?.object.material.name.startsWith('Paint')&&hit.point.y>.15,'Wheel wells must not cut through the central bonnet.');
    }
    for(const x of [-.67,.66])for(const z of [-.40,.40]){
      const hit=new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0)).intersectObject(asset.scene,true)[0];
      assert.ok(hit?.object.material.name.startsWith('Paint')&&hit.point.y>.38,'The fender must cover the tyre crown, leaving an opening only at the side.');
    }
    for(const z of [-.35,.35]){
      const hit=new Raycaster(new Vector3(.8,2,z),new Vector3(0,-1,0)).intersectObject(asset.scene,true)[0];
      assert.equal(hit?.object.material.name,'Headlamp','LED lenses must sit above their housing and remain exposed.');
    }
  }
  const stationaryBrakes=[];
  asset.scene.traverse(o=>{if(o.isMesh&&o.material.name==='Wheel brake calipers')stationaryBrakes.push(o);});
  prepareWheels(asset.scene,length);
  const rollingBatches=[];
  asset.scene.traverse(o=>{if(o.isMesh&&o.material.name==='Rolling wheels')rollingBatches.push(o);});
  assert.equal(rollingBatches.length,1,`${name}: brakes must share the wheel draw call`);
  const spin=rollingBatches[0].geometry.getAttribute('wheelSpin');
  assert.ok(spin&&Array.from(spin.array).some(v=>v===1));
  assert.equal(Array.from(spin.array).some(v=>v===0),stationaryBrakes.length>0,`${name}: calipers must remain fixed while rims rotate`);
  assert.ok((rollingBatches[0].geometry.index?.count??spin.count)/3<16000,`${name}: wheel detail must remain within the mobile geometry budget`);
  const beforeBatch=new Box3().setFromObject(asset.scene);
  const cabinColors=[];
  asset.scene.traverse(o=>{if(o.isMesh&&o.material.name==='Tailored cabin leather'){
    const c=o.geometry.getAttribute('color');cabinColors.push([c.getX(0)*o.material.color.r,c.getY(0)*o.material.color.g,c.getZ(0)*o.material.color.b]);
  }});
  const batch=batchColoredMeshes(asset.scene,mesh=>!['Automotive glass','Mirror silver','Headlamp','Tail lamp','Rolling wheels'].includes(mesh.material.name)&&!mesh.material.name.startsWith('Paint'),{surface:vehicleTrimSurface});
  assert.ok(batch?.geometry.getAttribute('color'),`${name}: trim colours must survive batching`);
  const surfaces=batch.geometry.getAttribute('surfaceResponse');
  assert.equal(surfaces.count,batch.geometry.getAttribute('position').count);
  assert.ok(Array.from(surfaces.array).some((v,i)=>i%2===1&&v>.9),`${name}: satin metal must retain its metallic response in the batch`);
  const batchColors=batch.geometry.getAttribute('color');
  for(const colour of cabinColors){
    let found=false;
    for(let i=0;i<batchColors.count&&!found;i++)found=colour.every((c,j)=>Math.abs(c-batchColors.getComponent(i,j))<.00001);
    assert.ok(found,`${name}: batching must preserve the leather palette instead of turning inserts white`);
  }
  const afterBatch=new Box3().setFromObject(asset.scene);
  assert.ok(beforeBatch.min.distanceTo(afterBatch.min)<.00001&&beforeBatch.max.distanceTo(afterBatch.max)<.00001,`${name}: batching must preserve vehicle shape and transforms`);
  let rolling=false;
  let painted=false;
  asset.scene.traverse(object=>{if(object.isMesh){
    if(object.material.name.startsWith('Paint')){
      painted=true;
      configureVehiclePaint(object.material,name,'high','#e54848');
      assert.equal(object.material.clearcoat,.92);
      configureVehiclePaint(object.material,name,'saver','#e54848');
      assert.equal(object.material.clearcoat,0);
      configureVehiclePaint(object.material,name,'standard','#e54848');
      assert.equal(object.material.clearcoat,.55);
    }
    if(object.material.name==='Rolling wheels'){
      rolling=true;assert.ok(object.geometry.getAttribute('color'),`${name}: wheel spokes require vertex colours`);
      const surface=object.geometry.getAttribute('wheelSurface');
      assert.ok(Array.from(surface.array).some((v,i)=>i%2===1&&v>.8)&&Array.from(surface.array).some((v,i)=>i%2===1&&v===0),`${name}: rolling rims and rubber require separate reflectance`);
      const pivots=object.geometry.getAttribute('wheelPivot'),centres=new Set();
      for(let i=0;i<pivots.count;i++)centres.add(`${pivots.getX(i).toFixed(2)}:${pivots.getY(i).toFixed(2)}:${pivots.getZ(i).toFixed(2)}`);
      assert.equal(centres.size,4,`${name}: four independent wheel centres required`);
    }
    object.geometry.dispose();object.material.dispose();
  }});
  assert.ok(painted,`${name}: colour-customisable paint material is required`);
  assert.ok(rolling,`${name}: rolling wheel batch required`);
}
for(let id=1;id<=40;id++){
  const level=JSON.parse(fs.readFileSync(path.join(root,'public/levels',`level-${String(id).padStart(3,'0')}.json`)));
  for(const car of level.cars)assert.equal(lengths[vehicleModel(car).kind],car.len,`Level ${id}: model length must match ${car.id}`);
}
console.log('3D asset orientation, lane bounds, paint and 40-level mappings passed');
