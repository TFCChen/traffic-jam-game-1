# Ground materials and optional rain-after scene

Build version: `0146274b`.

## Changes

- World-aligned asphalt aggregate, subtle sealed cracks, curb/drain grime and road tyre wear replace the old repeating asphalt map. Stone/paving/paint receive coordinated surface treatment.
- Rain-after theme is available immediately in the existing garage settings. It darkens damp areas, adds seven softly feathered low spots near margins, and uses a water clearcoat with water Fresnel reflectance. The central puzzle area stays free of large puddles.
- A small sky environment is convolved once for reflections; existing sun/local lights produce specular highlights. This does **not** reflect whole vehicle/building silhouettes or run scene-mirror/SSR passes each frame. Saver quality disables the extra clearcoat.
- No overlay ground planes or terrain geometry changes were added. The previously corrected foundation/reveal depth separation and stable fence shadow filter remain intact.
- Adjusted wet-film roughness after visually detecting a bright contour artifact at a reflected sun angle; the final `rain-glint.png` confirms smooth boundaries.

## Verification

- All 15 test suites passed; build replayed all 40 official level solutions.
- `verify-ground.mjs`: 11 views spanning dry/wet roads, reflection angles, cafe, dusk/night, overhead and mobile/saver; native rain-theme selection with no completed levels; no browser exceptions.
- `verify-exit.mjs`: native mouse/touch wins, low-angle exit, result timing, camera restoration, replay, reduced motion, editor trial return and official next-level flow passed. User local storage restored after verification.
- Screenshots and raw measurements are saved alongside this document and under `gameplay/`.

| Profile | CPU median | GPU median | Draw calls |
| --- | ---: | ---: | ---: |
| Dry desktop | 1.30 ms | 13.63 ms | 100 |
| Wet desktop | 1.50 ms | 16.68 ms | 101 |
| Wet mobile viewport | 1.30 ms | 18.45 ms | 101 |

The mobile measurement uses desktop Chrome at 393×844 with emulated DPR 3 (renderer caps actual ratio to 2), not physical phone hardware. Desktop GPU p95 reached 42–45 ms during this short headless sample, so medians are not a guarantee of uninterrupted 60 FPS. Idle averaged 26.9 FPS under the existing 30 FPS cap, with zero idle shadow updates and zero offscreen frames. Wet materials add two terrain draw calls over the prior 98-call dry baseline, but no per-frame reflection capture.
