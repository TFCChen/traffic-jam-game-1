# Vehicle lighting and exhaust — 2026-10-06

The active/selected car (the target car by default) now owns real front and rear SpotLights. The two visible headlamp lenses share a merged forward cone: 63° full angle, 5.5 grid units of reach, inverse-square attenuation and a soft cutoff. A separate red rear light has a broader, shorter cone (115° / 1.6 units); braking increases its power. Tail lenses remain red while reversing. Dusk/night increase headlight power; actual road and vehicle materials receive the lighting, with shadow-map occlusion.

The previous flat additive headlight decals have been removed. A fixed two-light pool prevents every parked vehicle from adding lights and shadow passes. Each map is 256×256, cached while stationary and updated at most 20 Hz during motion. Sun shadows are cached independently so headlight refreshes do not force redundant sun-map rendering. Saver mode disables these decorative effects.

Both new shadow textures are initialized once even with the daytime lamps off. Otherwise an uninitialized depth sampler can prevent PBR meshes from appearing until the first drag. The regression suite checks this condition, and the first-load daytime screenshot confirms complete scenery before any input.

Exhaust emits at the model's rear outlet, including vertical cars and the exit animation. Soft procedural noise sprites replace sphere smoke. Puffs rise, drift, expand, rotate and fade over 1.8–2.4 seconds. All 56 reusable particles use one instanced draw call; small fast-movement sparks retain a separate eight-particle pool. Reduced-motion preferences suppress smoke.

## Verification

- `npm test`: lighting direction for both axes, red tail color, cone reach/falloff, shadow cache invalidation, smoke growth/rise/expiry/pool reuse, plus existing engine/assets/storage/camera/dynamics tests.
- `npm run build`: all 40 official solution routes replayed; production build and versioned PWA snapshot generated.
- `scripts/verify-vehicle-effects.mjs`: real CDP pointer selection, forward/reverse drags, move counting and undo; day/dusk/night, vertical vehicle, 90° overhead and 390×844 DPR2 mobile emulation. Full-resolution glass retained during motion; no runtime or WebGL errors. Local progress/settings restored after testing.
- Performance uses RAF-driven continuous pointer movement after a real CDP selection, avoiding measurement limits caused by per-event CDP round trips. Nine-car high/standard day/night profiles are in `verification.json`: approximately 9–10 rendered FPS in this integrated-GPU automation environment, with median GPU submission timings of 43–62 ms. This remains below the desired smooth-play target; the fixed pool/cache limits cost but does not establish acceptable performance on weak GPUs. No physical-phone performance benchmark was performed.
- `scripts/verify-production-cache.mjs`: legacy service-worker recovery, correct model hash, version-mismatch rejection, preserved progress and offline loading passed; see `offline.json`.

Screenshots record moving headlights, reverse tail lamps, day/dusk/night, vertical direction, overhead and mobile layouts. Smoke is deliberately subtle rather than dense opaque exhaust.
