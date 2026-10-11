import * as THREE from 'three';

// Artistic low-beam photometry for the miniature courtyard, not a certified
// automotive IES measurement. Coordinates are slopes in the lamp camera plane.
// Both lamps use the same forward-facing pattern; overlap comes from spread,
// never from toeing the lamps inward. +right is the vehicle's roadside half.
export const HEADLIGHT_ANGLE = .68;
export const HEADLIGHT_DROP = .26;
export function lowBeamProfile(right, up) {
  const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  const cutoff = .035 + .035 * smooth(-.04, .22, right);
  const upper = 1 - smooth(cutoff - .012, cutoff + .012, up);
  const rim = 1 - smooth(.76, .98, Math.hypot(right, up));
  const hotspot = .72 * Math.exp(-(((right - .045) / .48) ** 2) - ((up + .105) / .105) ** 2);
  const spread = .30 * Math.exp(-((right / .82) ** 4) - ((up + .24) / .30) ** 2);
  // The soft lower skirt joins the bumper foreground to the main road pool.
  const foreground = .19 * Math.exp(-((right / .72) ** 4) - ((up + .54) / .30) ** 2);
  return Math.min(1, hotspot + spread + foreground) * upper * rim;
}

export function createLowBeamTexture(size = 128) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = Math.round(255 * lowBeamProfile(2 * (x + .5) / size - 1, 2 * (y + .5) / size - 1));
    const offset = (y * size + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.name = 'Low beam: cutoff, wide spread and foreground';
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

