import { ShaderChunk } from 'three';

// Three marks pixels outside a local lamp's cone/range as invisible, but still
// evaluates the complete PBR BRDF with zero irradiance. Skip that work while
// retaining the same light, shadow and clearcoat response for illuminated pixels.
export function cullUnlitPixels() {
  const marker='// garage-local-light-culling';
  if(ShaderChunk.lights_fragment_begin.includes(marker))return;
  const call='RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  ShaderChunk.lights_fragment_begin=marker+'\n'+ShaderChunk.lights_fragment_begin.replaceAll(call,'if ( directLight.visible ) '+call);
}
