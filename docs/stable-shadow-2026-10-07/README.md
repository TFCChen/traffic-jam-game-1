# Stable PCF shadows — follow-up to the Android recording

Build `6e738453`. The supplied 7.12-second Android recording was extracted and inspected at multiple adjacent frames. It shows orbit/pinch movement with dark changes near the fence/ground boundary. The preceding repair addressed depth precision and duplicate fence corners, but did not address screen-dependent PCF sampling.

Three 0.186.1 rotates its five-sample PCF kernel using `interleavedGradientNoise(gl_FragCoord.xy)`. This attaches the sampling pattern to screen pixels rather than the world, so thin shadows change when the camera moves even if the shadow map is unchanged. The replacement holds the five-tap Vogel kernel at a fixed rotation, including point-light PCF. Hardware bilinear shadow filtering stays enabled; texture-fetch count, resolution and update cadence are unchanged.

The sun's depth bias was also corrected to -0.0001: the normal-depth PCF shader **adds** bias to receiver depth, so a small negative offset moves the receiver toward the light. The previous positive bias could promote self-shadowing on bevels. The bounded 1–32 clip interval and 0.008 normal bias are retained.

## Controlled browser comparison

`node scripts/verify-shadow-phase.mjs <isolated Chrome CDP websocket>` compiles the actual game shaders at 393×844 / DPR 3, pitch 45°, yaw -25°, zoom 1.3. A test-only shader hook restores the original rotating kernel for the baseline and then offsets the noise's screen coordinates without changing the world, camera or shadow map. The hook confirms 19 intercepted compiled shaders on each run. Cache/service-worker bypass ensures the built source is tested.

The empty fence strip is masked to exclude unrelated timed vehicle effects. [Hashes](phase/hashes.json) differ for the rotating baseline, but match exactly for the fixed kernel. [Pixel comparison](phase/comparison.json) reports 481 pixels changing by more than one RGB level in a 34,176-pixel strip for the rotating kernel, versus zero for the fixed kernel. This demonstrates the sampling instability independently of camera motion; it is not a physical-device certification.

## Interaction and regressions

- [Native input inspection](inspection.json): desktop right-drag orbit, middle-drag pan and wheel zoom in high/standard quality, day/sunset/neon; all retain shadows with zero map refreshes during camera movement.
- Mobile 393×844 / DPR 3: one-finger orbit outside the lot followed by two-finger pan/pinch. Eight consecutive [orbit frames](mobile-orbit-1.png) through [frame 8](mobile-orbit-8.png) and before/after screenshots were reviewed. No browser runtime or console errors.
- `npm test`: 13 modules passed. The shader regression rejects screen-noise sampling, preserves the original fetch budget, checks idempotent setup and forces review if a future Three update changes the patched code. Existing scene-depth and geometry checks still pass.
- `npm run build`: 40 official routes replayed, production assets and offline cache generated.

Tests use desktop Chrome with device emulation. The supplied phone's GPU was not remotely accessible; confirmation on that device is still valuable. Ordinary subpixel edge aliasing may still be visible, especially on thin geometry.
