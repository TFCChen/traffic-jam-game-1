import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STREET } from './streetLayout.js';

// Reuse an authored bevelled curb stone, including its normals, rather than
// attaching a different box-shaped road kit to the finished courtyard.
function curbTemplate(mesh, inverse) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  const p = [], n = [], bounds = new THREE.Box3(new THREE.Vector3(10.083, .003, -2.154), new THREE.Vector3(10.177, .129, -1.746));
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 3) {
    if (![0,1,2].every(j => bounds.containsPoint(point.fromBufferAttribute(positions, i+j)))) continue;
    for (let j = 0; j < 3; j++) {
      p.push(positions.getX(i+j)-10.13, positions.getY(i+j)-.066, positions.getZ(i+j)+1.95);
      n.push(normals.getX(i+j),normals.getY(i+j),normals.getZ(i+j));
    }
  }
  geometry.dispose();
  if (!p.length) return null;
  const result = new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  result.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));
  return result;
}

export function extendStreetRoad(garage) {
  garage.updateMatrixWorld(true);
  const inverse = garage.matrixWorld.clone().invert(), stones = [], normalFormats = new Map();
  let asphalt, markings, foundation;
  const foundationBounds = new THREE.Box3();
  garage.traverse(mesh => {
    if (!mesh.isMesh) return;
    normalFormats.set(mesh.material,mesh.geometry.attributes.normal);
    if (mesh.material.name === 'Street asphalt') asphalt = mesh;
    if (mesh.material.name === 'Parking markings') markings = mesh.material;
    if (mesh.material.name === 'Basalt foundation') {
      foundation = mesh.material;
      mesh.geometry.computeBoundingBox();
      foundationBounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));
    }
    if (mesh.material.name === 'Honed warm limestone') stones.push(mesh);
  });
  if (!asphalt) return [];
  const owned = [], add = (geometry, material, name) => {
    const normal=geometry.attributes.normal, format=normalFormats.get(material);
    if(normal && format && normal.array.constructor!==format.array.constructor) {
      const converted=new THREE.BufferAttribute(new format.array.constructor(normal.count*3),3,format.normalized);
      converted.gpuType=format.gpuType;
      for(let i=0;i<normal.count;i++)converted.setXYZ(i,normal.getX(i),normal.getY(i),normal.getZ(i));
      geometry.setAttribute('normal',converted);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.raycast = () => {};
    garage.add(mesh); owned.push(geometry); return mesh;
  };
  // A single continuous surface eliminates overlapping receivers and colour
  // seams. Bake only this mesh's transform; never modify shared GLB geometry.
  const surface = asphalt.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, asphalt.matrixWorld));
  surface.computeBoundingBox();
  const bounds = surface.boundingBox.clone(), center = bounds.getCenter(new THREE.Vector3());
  const positions = surface.attributes.position;
  const roadLength=STREET.max-STREET.min,roadCenter=(STREET.max+STREET.min)/2;
  for (let i = 0; i < positions.count; i++) positions.setZ(i, roadCenter + (positions.getZ(i)-center.z)*roadLength/(bounds.max.z-bounds.min.z));
  positions.needsUpdate = true; surface.computeBoundingBox(); surface.computeBoundingSphere();
  asphalt.removeFromParent();
  add(surface,asphalt.material,'Continuous neighbourhood street');
  if (foundation) {
    // The authored courtyard already has a slab, and each tunnel owns its
    // full-width stone plinth. Fill only the two small uncovered joins.
    // A second full-length slab put coplanar dark faces on both tunnel backs.
    const joins=[];
    for(const [a,b]of [[STREET.north,Math.min(STREET.south,foundationBounds.min.z)],
      [Math.max(STREET.north,foundationBounds.max.z),STREET.south]]) {
      if(b-a<=.0001)continue;
      joins.push(new THREE.BoxGeometry(bounds.max.x-bounds.min.x,.48,b-a).translate(center.x,-.24,(a+b)/2));
    }
    if(joins.length) {
      const geometry=mergeGeometries(joins);joins.forEach(g=>g.dispose());
      add(geometry,foundation,'Street foundation');
    }
  }
  const templates = stones.map(mesh => ({geometry:curbTemplate(mesh,inverse),material:mesh.material})).filter(item=>item.geometry);
  if (!templates.length) throw Error('Authored street curb template missing');
  const pieces = [];
  for (let i = -16; i <= 44; i++) {
    if (i >= 0 && i <= 28) continue;
    const z = -1.95 + i*.42;
    if(z-.21<STREET.min||z+.21>STREET.max)continue;
    for (const x of [6.48,10.13]) for (const template of templates) {
      const piece = template.geometry.clone();
      if (x < 8) piece.scale(1,.13/.12,1);
      piece.translate(x,x<8?.074:.066,z); pieces.push(piece);
    }
  }
  const curbs = mergeGeometries(pieces);
  curbs.setIndex(Array.from({length:curbs.attributes.position.count},(_,i)=>i));
  pieces.forEach(piece=>piece.dispose()); templates.forEach(item=>item.geometry.dispose());
  add(curbs,templates[0].material,'Matching continuous stone curbs');
  if (markings) {
    const p = [], n = [];
    // Same x and cadence as the authored dashes, continuing the same phase.
    for (let i = -9; i < 24; i++) {
      if (i >= 0 && i < 15) continue;
      const z = -1.75+i*.82, x = 8.05, y = .0405;
      if(z-.18<STREET.min||z+.18>STREET.max)continue;
      for (const [px,pz] of [[x-.019,z-.18],[x-.019,z+.18],[x+.019,z-.18],[x+.019,z-.18],[x-.019,z+.18],[x+.019,z+.18]]) {
        p.push(px,y,pz); n.push(0,1,0);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));
    add(geometry,markings,'Aligned street dashes');
  }
  return owned;
}
