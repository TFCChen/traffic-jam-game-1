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

// Thin optical sheets use angle-dependent absorption and physical reflections.
// The refractive path is retained only for isolated visual/performance comparisons.
export function configureVehicleGlass(material, quality, optics = 'thin-sheet') {
  const refractive = optics === 'refractive' && quality !== "saver";
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
  const previousOptics=material.userData.optics;
  material.userData.optics=refractive?'refractive':'thin-sheet';
  material.onBeforeCompile=refractive?()=>{}:shader=>{
    // A 4 mm pane barely displaces the cabin image. Render its PBR reflection
    // over the existing scene, rather than re-rendering every opaque object.
    // Fresnel reflection and longer tinted paths at grazing angles remain.
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float paneCos=max(.001,abs(dot(geometryNormal,geometryViewDir)));
      float paneFresnel=.04+.96*pow(1.-paneCos,5.);
      // Smoked solar film absorbs light without scattering the cabin image.
      // Beer-Lambert absorption deepens smoothly along oblique viewing paths.
      float paneAbsorption=1.-exp(-.28/max(.30,paneCos));
      float paneAlpha=clamp(paneAbsorption+(1.-paneAbsorption)*paneFresnel,.04,.94);
      outgoingLight=(totalSpecular+totalEmissiveRadiance)/paneAlpha;
      diffuseColor.a=paneAlpha;
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey=()=>refractive?'refractive-glass-v1':'thin-sheet-glass-v2';
  if (wasRefractive !== refractive || wasTransparent !== material.transparent || wasSide !== material.side)
    material.needsUpdate = true;
  if(previousOptics!==material.userData.optics) material.needsUpdate=true;
}
