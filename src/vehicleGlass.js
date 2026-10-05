import * as THREE from "three";

export const VEHICLE_GLASS = "Automotive glass";
export const VEHICLE_MIRROR = "Mirror silver";

// Transmission renders the opaque scene once, shared by all vehicle windows.
// Saver mode retains see-through windows without the extra framebuffer pass.
export function configureVehicleGlass(material, quality) {
  const refractive = quality !== "saver";
  const wasRefractive = material.transmission > 0;
  const wasTransparent = material.transparent;
  material.color.set("#b8ced5");
  material.metalness = 0;
  material.roughness = quality === "high" ? 0.018 : 0.035;
  material.ior = 1.48;
  material.transmission = refractive ? 0.9 : 0;
  material.thickness = 0.012;
  material.attenuationColor.set("#9ebac4");
  material.attenuationDistance = 1.8;
  material.envMapIntensity = 1.25;
  material.transparent = !refractive;
  material.opacity = refractive ? 1 : 0.34;
  material.depthWrite = refractive;
  material.side = THREE.DoubleSide;
  material.forceSinglePass = true;
  if (wasRefractive !== refractive || wasTransparent !== material.transparent)
    material.needsUpdate = true;
}
