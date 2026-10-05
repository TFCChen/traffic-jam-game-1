import * as THREE from "three";

export const VEHICLE_GLASS = "Automotive glass";
export const VEHICLE_MIRROR = "Mirror silver";

// Explicit optical faces let thin panes remain visible from inside and outside
// without Three's DoubleSide transmission back-volume framebuffer pass.
// The four-millimetre panes do not need a separate refractive volume resolve.
export function prepareVehicleGlass(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const result = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values = new attribute.array.constructor(attribute.array.length * 2);
    values.set(attribute.array);
    const size = attribute.itemSize;
    for (let triangle = 0; triangle < attribute.count; triangle += 3) {
      for (let vertex = 0; vertex < 3; vertex++) {
        const from = (triangle + (vertex === 0 ? 0 : 3 - vertex)) * size;
        const to = (attribute.count + triangle + vertex) * size;
        for (let component = 0; component < size; component++)
          values[to + component] = attribute.array[from + component] * (name === 'normal' ? -1 : 1);
      }
    }
    result.setAttribute(name, new THREE.BufferAttribute(values, size, attribute.normalized));
  }
  source.dispose();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

// Transmission renders the opaque scene once, shared by all vehicle windows.
// Saver mode retains see-through windows without the extra framebuffer pass.
export function configureVehicleGlass(material, quality) {
  const refractive = quality !== "saver";
  const wasRefractive = material.transmission > 0;
  const wasTransparent = material.transparent;
  const wasSide = material.side;
  // A neutral cool solar-film tint dims the cabin without scattering its image.
  material.color.set("#cfdee3");
  material.metalness = 0;
  material.roughness = 0.003;
  material.ior = 1.48;
  material.transmission = refractive ? 1 : 0;
  material.thickness = 0.004;
  material.attenuationColor.set("#819ca5");
  material.attenuationDistance = 0.18;
  material.envMapIntensity = 1.25;
  material.transparent = !refractive;
  material.opacity = refractive ? 1 : 0.34;
  material.depthWrite = refractive;
  material.side = THREE.FrontSide;
  material.forceSinglePass = true;
  if (wasRefractive !== refractive || wasTransparent !== material.transparent || wasSide !== material.side)
    material.needsUpdate = true;
}
