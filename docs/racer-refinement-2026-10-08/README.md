# Racer detail refinement — 2026-10-08

Final build: `8b8789ef`. Baseline asset: commit `34c772c` (`f8890f63`).

The rear engine panel formerly intersected the sculpted shell, exposing only fragments of flat louvres. It now has a rounded pocket, a conforming dark floor and six curved inset blades. The floor and blades sample the actual deck, including its center, so the floor cannot bridge over and hide the blades. Bonnet and door seams are thinner. Twin exhaust tips have rolled metal lips and recessed dark bores. The previously hidden rear number plate now sits in front of its mounting frame and coachwork.

`art/racer.blend` is the current editable standalone racer. Reproduce it with Blender 4.5:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python scripts/build_models.py -- --vehicle racer
```

Single-vehicle mode leaves all eight other exported vehicles and the latest courtyard untouched. No runtime rendering, glass, wheel steering, lighting, camera, puzzle or UI code changed.

## Geometry and verification

- Racer triangles: 39,624 → 40,266 (+642, approximately 1.6%).
- GLB bytes: 1,259,716 → 1,279,876 (+20,160, approximately 1.6%).
- Full-board day draw calls remain 100 after existing trim batching.
- All 16 test suites and production build pass; 40 official solutions precomputed and replayed.
- New asset rays verify visible recessed vent floor, visible blades, metal exhaust lips/deeper bores, and exposed rear plate. Existing wheel-arch, glass, cabin, vehicle bounds and lighting checks pass.
- Day/sunset close views and desktop/mobile viewport profiles: `final/inspection.json`, `final/*.png`. Final version and asset URL recorded; browser error collection empty.
- Native mouse/touch drag, wins, steering, continuous exit, replay, reduced motion, trial return and next-level checks: `gameplay/results.json`, `gameplay/*.png`. These checks were performed after the vent/exhaust changes and before the final plate mounting correction; final plate placement was additionally checked by asset rays and rendered rear views.
- Baseline matching views: `before/*.png`; the additional low rear angle has no baseline capture. This is a focused parts refinement, not a wholesale body redesign.

## Performance comparison

`paired-performance.json` uses ABBA order in one hardware Chrome instance. Only the isolated browser's racer request is intercepted to supply the prior GLB; the served localhost files remain current. Same current runtime, scene, settings and viewport per pair, DPR 1, 1.2 seconds warmup and 5 seconds sample per run. Triangle counts confirm the intended old/new geometry actually loaded.

| Viewport | Before GPU medians (ms) | After GPU medians (ms) | Draw calls |
| --- | --- | --- | --- |
| Desktop 1440×950 | 14.54, 17.28 | 17.36, 17.36 | 100 throughout |
| Mobile viewport 393×844 | 12.55, 12.43 | 12.55, 12.54 | 100 throughout |

CPU medians range 1.1–1.5 ms. Desktop timings drifted even between old-asset samples, so the initial fast sample cannot establish the geometry's standalone cost. Later desktop medians and mobile samples are close, with no extra draw calls. These are measurements on this Windows GPU, not physical-phone performance or a guarantee of identical frame times on every device.
