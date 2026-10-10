# Overlapping perimeter surfaces — 2026-10-07

Build `7048d170`. Fence shadow isolation did not improve the user's physical-phone result. Asset inspection then found an actual depth conflict in the same exposed ring: both the dark basalt foundation and the light limestone reveal had a top surface at world Y = 0. Their different triangles and vertex colours compete for the same depth-buffer values as the view changes. Shadow flags cannot repair this geometry conflict.

| Layer | Previous top | Repaired top |
| --- | ---: | ---: |
| Visible limestone reveal | 0 | 0 |
| Dark structural foundation | 0 | -0.06 |

The structural slab's bottom remains -0.48; its centre/height change from -0.24/0.48 to -0.27/0.42. Its top is now inside the stone thickness (stone bottom -0.07), so the layers overlap structurally without sharing the visible surface. Parking/road elevations, puzzle dimensions and vehicle positions are unchanged. The Blender scene and GLB were updated by rebuilding only the slab with the original bevel/weighted-normal helper.

The independent fence batch's normal shadow casting and receiving have been restored. No render-resolution or refresh-rate changes are part of this repair.

## Evidence and verification

- [Layer report](layers.json): all four representative border points in the original GLB have zero separation; the repaired GLB has 0.060000017 separation. `environmentAssets.test.mjs` now samples 112 positions across all four edges and rejects stone/slab separation of 0.04 or less.
- All 13 `npm test` modules passed, including unchanged pavement/exit support and vehicle assets. Production build replayed all 40 official routes and generated the offline cache.
- [Native interaction report](interaction/inspection.json): desktop orbit/pan/wheel in day/high, standard, sunset and neon; mobile 393×844 / DPR 3 one-finger orbit and two-finger pan/pinch. Fence is visible with both shadow flags **true**, shadows stay enabled, and camera motion adds no shadow-map refreshes. Screenshots were reviewed; no runtime/console errors.
- `verify-perimeter-depth.mjs` additionally loads each GLB through request interception into the same current renderer, with all shadows disabled, at seven camera yaws. Fourteen intercepts were confirmed. [Capture diagnostics](depth-comparison.json) include projected colour samples, but these are not treated as a flicker metric: foreground cars/furniture can occlude some sample positions at different yaws. The structural ray/clearance checks are the regression criterion.

This fixes a confirmed coplanar geometry defect at the reported location. Desktop Chrome emulation cannot substitute for the user's Android GPU; the final physical-device result still needs confirmation. The prior shadow-filter and isolation tests must not be cited as proof that this geometry issue was absent.

Reproduce native checks with `VERIFY_SHADOW_OUTPUT_DIR=../docs/perimeter-depth-2026-10-07/interaction/` and `VERIFY_FENCE_SHADOWS=on`, then run `scripts/verify-fence-shadows.mjs` with an isolated Chrome CDP websocket. The GLB comparison script accepts the previous asset path as its third argument; obtain that binary from commit `1ef1d93` without text-mode redirection.
