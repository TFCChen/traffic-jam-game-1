// Preserve a common toy-car palette while giving each coating its own response.
export function configureVehiclePaint(material, kind, quality, color) {
  const commercial = ['coach', 'schoolbus', 'camper', 'delivery'].includes(kind);
  const coat = quality === 'saver' ? 0 : quality === 'high' ? .92 : .55;
  const changed = (material.clearcoat > 0) !== (coat > 0);
  material.color.set(color);
  material.metalness = commercial ? .035 : kind === 'racer' ? .16 : .12;
  material.roughness = commercial ? .32 : .27;
  material.envMapIntensity = commercial ? 1 : 1.12;
  material.clearcoat = coat;
  material.clearcoatRoughness = commercial ? .17 : .11;
  if(!material.userData.courtyardOcclusion) {
    material.userData.courtyardOcclusion=true;
    material.onBeforeCompile=shader=>{
      // Diffuse skylight is occluded below the chassis. Direct lamp/sun light
      // remains intact, so a nearby headlamp can still illuminate these faces.
      shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',
        `#include <aomap_fragment>
        float underbodyVisibility=mix(.62,1.,smoothstep(-.65,.18,inverseTransformDirection(geometryNormal,viewMatrix).y));
        reflectedLight.indirectDiffuse*=underbodyVisibility;`);
    };
    material.customProgramCacheKey=()=> 'courtyard-paint-occlusion-v1';
  }
  if (changed) material.needsUpdate = true;
}

export function vehicleTrimSurface(material) {
  if (material.name === 'Wheel hubs') return [.22, .92];
  if (material.name === 'Tyre rubber') return [.86, 0];
  if (material.name === 'Smoked panel glass') return [.16, .04];
  if (material.name === 'Warm white trim') return [.56, 0];
  return [material.roughness ?? .6, material.metalness ?? 0];
}

// One batch can retain rubber and metal instead of averaging their response.
export function surfaceShader(shader, attribute = 'surfaceResponse') {
  shader.vertexShader = `attribute vec2 ${attribute};\nvarying vec2 finishResponse;\n` + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
    `#include <begin_vertex>\nfinishResponse=${attribute};`);
  shader.fragmentShader = 'varying vec2 finishResponse;\n' + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
    '#include <roughnessmap_fragment>\nroughnessFactor=finishResponse.x;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>',
    '#include <metalnessmap_fragment>\nmetalnessFactor=finishResponse.y;');
}
