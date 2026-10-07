import * as THREE from 'three';

export function configureCourtyardSunShadow(shadow) {
  // A 500-unit depth range made small normalized offsets large relative to
  // thin rails. Fixed courtyard bounds keep precision stable during orbit.
  Object.assign(shadow.camera, {left:-8,right:8,top:8,bottom:-8,near:1,far:32});
  shadow.camera.updateProjectionMatrix();
  shadow.normalBias = 0.008;
  // Standard depth compares add bias to receiver depth: negative moves it
  // toward the light, leaving the small rail surfaces free of shadow acne.
  shadow.bias = -0.0001;
}

// Static canopy clusters cast soft silhouettes using ~80 triangles each.
// The full authored leaves remain in the camera pass and receive lighting.
export function vegetationShadowProxy(foliage) {
  foliage.updateWorldMatrix(true,false);
  const positions=foliage.geometry.attributes.position,bins=new Map(),point=new THREE.Vector3();
  for(let i=0;i<positions.count;i++) {
    point.fromBufferAttribute(positions,i).applyMatrix4(foliage.matrixWorld);
    const key=`${Math.floor(point.x/.75)}:${Math.floor(point.y/.6)}:${Math.floor(point.z/.75)}`;
    if(!bins.has(key))bins.set(key,new THREE.Box3());
    bins.get(key).expandByPoint(point);
  }
  const geometry=new THREE.SphereGeometry(1,8,6);
  // Shadow rendering uses its own depth material. Colour/depth writes are
  // disabled only for the regular camera pass, so proxies never cover artwork.
  const material=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
  const mesh=new THREE.InstancedMesh(geometry,material,bins.size),pose=new THREE.Object3D();
  mesh.name='Lightweight vegetation shadows';mesh.castShadow=true;mesh.receiveShadow=false;
  let index=0;
  for(const box of bins.values()) {
    box.getCenter(pose.position);box.getSize(pose.scale).multiplyScalar(.56);
    pose.scale.max(new THREE.Vector3(.025,.025,.025));pose.updateMatrix();mesh.setMatrixAt(index++,pose.matrix);
  }
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
  return mesh;
}
