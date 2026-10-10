import {ShaderChunk} from 'three';

// Three's PCF kernel rotates with gl_FragCoord. Without temporal accumulation
// this makes fine rail shadows change as their image moves across the screen.
// Keep the same five hardware-filtered taps, with a fixed light-space kernel.
export function stableShadowSource(source) {
  const rotating='float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;';
  if(!source.includes(rotating))throw new Error('PCF shadow shader changed; review stable filtering before updating Three.');
  return source.replaceAll(rotating,'float phi = 0.0; // courtyard-stable-PCF');
}

export function stabilizeShadowFilter() {
  if(ShaderChunk.shadowmap_pars_fragment.includes('courtyard-stable-PCF'))return;
  ShaderChunk.shadowmap_pars_fragment=stableShadowSource(ShaderChunk.shadowmap_pars_fragment);
}
