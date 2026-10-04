import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Box3,Raycaster,Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { vehicleModel } from './vehicleModels.js';
import { prepareWheels,batchColoredMeshes } from './garageMaterials.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lengths={racer:2,jeep:2,pickup:2,compact:2,taxi:2,schoolbus:3,coach:3,camper:3,delivery:3};
for(const [name,length]of Object.entries(lengths)){
  const bytes=fs.readFileSync(path.join(root,'public/models',`${name}.glb`));
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const bounds=new Box3().setFromObject(asset.scene);
  assert.ok(bounds.min.x>=-length/2-.12&&bounds.max.x<=length/2+.12,`${name}: vehicle must remain centred on its lane`);
  assert.ok(bounds.min.z>=-.54&&bounds.max.z<=.54,`${name}: vehicle must fit within one lane`);
  assert.ok(bounds.min.y>=-.001&&bounds.max.y>.5&&bounds.max.y<1.3,`${name}: GLB must use the correct up axis and rest on its tyres`);
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
  prepareWheels(asset.scene,length);
  const beforeBatch=new Box3().setFromObject(asset.scene);
  const batch=batchColoredMeshes(asset.scene,mesh=>!['Opaque blue glass','Headlamp','Tail lamp','Rolling wheels'].includes(mesh.material.name)&&!mesh.material.name.startsWith('Paint'));
  assert.ok(batch?.geometry.getAttribute('color'),`${name}: trim colours must survive batching`);
  const afterBatch=new Box3().setFromObject(asset.scene);
  assert.ok(beforeBatch.min.distanceTo(afterBatch.min)<.00001&&beforeBatch.max.distanceTo(afterBatch.max)<.00001,`${name}: batching must preserve vehicle shape and transforms`);
  let rolling=false;
  let painted=false;
  asset.scene.traverse(object=>{if(object.isMesh){
    if(object.material.name.startsWith('Paint'))painted=true;
    if(object.material.name==='Rolling wheels'){
      rolling=true;assert.ok(object.geometry.getAttribute('color'),`${name}: wheel spokes require vertex colours`);
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
