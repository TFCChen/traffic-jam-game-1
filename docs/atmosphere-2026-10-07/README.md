# Quiet courtyard atmosphere — 2026-10-07

The courtyard foliage now responds to a gentle shared breeze with small local variations. Trunks and the cached vegetation shadow proxy remain fixed. Vertex displacement uses precomputed world-space profiles and a few shared uniforms; it does not rebuild foliage geometry or sun shadows each frame.

Eight reusable folded leaf particles replace the old four rectangular particles. Only a few are visible together. They descend beside the trees, settle without sliding, then fade. Their entire paths stay outside the playable 6×6 grid. Saver quality, reduced motion and editor mode disable ambient motion.

The cafe service window gains restrained warm illumination and a small, unshadowed exterior spill light at sunset/night. Daytime glass retains its reflective material. There are no extra UI controls or sound.

## Validation

- `npm test`: all 14 suites passed, including leaf containment, population bounds, settled poses, maximum wind displacement, reduced motion, saver quality and cleanup without mutating shared model geometry.
- `npm run build`: all 40 official solution routes replayed successfully.
- `verify-courtyard.mjs`: eight desktop/mobile views; no browser errors. Idle rendering 29.9 FPS, no idle shadow updates, zero offscreen frames.
- `verify-fence-shadows.mjs`: real mouse orbit/pan/zoom and emulated touch orbit/pan/pinch; day/standard/sunset/night/mobile DPR 3. Fixed shadow updates during camera gestures: zero. Normal fence casting/receiving remains enabled.
- `verify-atmosphere.mjs`: visible wind changes without shadow refresh, warm cafe illumination, live reduced-motion switching, saver mode, CPU/GPU timer sampling.
- `verify-exit.mjs`: native mouse/touch victories, low-angle exit, camera restoration, replay, reduced-motion victory, trial return to editor and official next-level navigation.

High-quality profile samples from isolated desktop Chrome:

| View | CPU median | GPU median | Draw calls |
| --- | ---: | ---: | ---: |
| Desktop day | 1.4 ms | 14.2 ms | 97 |
| Desktop night | 1.9 ms | 27.5 ms | 98 |
| Mobile viewport, DPR 3 | 1.9 ms | 13.8 ms | 97 |

These timings measure the whole scene on this computer, not the incremental cost of the new effects. The mobile case emulates screen size/touch/DPR and does not measure a physical phone's GPU. Night rendering remains the heavier case and should be monitored on real devices before adding more local lights.

Snapshots and inspection JSON files are saved alongside this report. The previously repaired stone/plinth depth separation is unchanged.
