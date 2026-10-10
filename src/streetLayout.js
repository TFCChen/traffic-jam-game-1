import * as THREE from 'three';

// Two low, covered neighbourhood passages enclose a finite stretch of street.
// The rear wall is real geometry; there is no world-space vehicle clipping.
export const STREET = Object.freeze({
  min: -8.7, max: 16.7, north: -2.45, south: 10.45,
  left: 6.34, right: 10.25, ceiling: 1.48, roof: 1.58,
});
export function passageBoxes() {
  return [[STREET.min, STREET.north], [STREET.south, STREET.max]].flatMap(([a,b]) => [
    new THREE.Box3(new THREE.Vector3(6.08,STREET.ceiling,a),new THREE.Vector3(10.51,STREET.roof,b)),
    new THREE.Box3(new THREE.Vector3(6.08,0,a),new THREE.Vector3(STREET.left,STREET.ceiling,b)),
    new THREE.Box3(new THREE.Vector3(STREET.right,0,a),new THREE.Vector3(10.51,STREET.ceiling,b)),
    new THREE.Box3(new THREE.Vector3(6.08,0,a===STREET.min?a:b-.2),new THREE.Vector3(10.51,STREET.ceiling,a===STREET.min?a+.2:b)),
  ]);
}
const solids = passageBoxes();
const ray = new THREE.Ray(), hit = new THREE.Vector3(), direction = new THREE.Vector3();
export function vehicleHiddenInPassage(camera, x, z, length) {
  camera.getWorldDirection(direction).negate();
  // Include mirrors and the soft contact footprint, not just the body centre.
  for (const dx of [-.64,0,.64]) for (const dz of [-length/2-.2,0,length/2+.2]) for (const y of [.02,.7,1.4]) {
    ray.set(new THREE.Vector3(x+dx,y,z+dz),direction);
    if (!solids.some(box => ray.intersectBox(box,hit))) return false;
  }
  return true;
}
export function passageTrafficRoute(camera, x, length) {
  // At the minimum permitted elevation (30 degrees), even the lowest car
  // point meets the opaque roof before a ray can escape through the opening.
  const depth = length/2+.2 + (STREET.ceiling-.02)/Math.tan(Math.PI/6) + .2;
  const route = {min:STREET.north-depth,max:STREET.south+depth};
  return vehicleHiddenInPassage(camera,x,route.min,length) && vehicleHiddenInPassage(camera,x,route.max,length) ? route : null;
}
export function streetRainExposure(z) {
  return Math.max(0, Math.min(1, Math.min(z-STREET.north,STREET.south-z)/.6+1));
}
