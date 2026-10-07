# Natural wet materials and lower rain cost

Version `1119b6e1`. Corrects oversized beads, missing runoff trails, dark puddle patches, overly mirrored asphalt and rain-mode stutter.

## Changes

- Removed the planar scene reflector, its render target, capture keys and the second scene render. Ground uses a single standard GGX material layer, sky environment and existing local lights; there are no vehicle/building mirror silhouettes on asphalt.
- Wet asphalt retains aggregate normals and approximately .60 wet roughness; paving targets .42, stone .52 and paint markings .58. Local water-film smoothing remains small. These are authored material distinctions, not a measured asphalt BRDF or a full rough-reflection simulation.
- Replaced large per-fragment procedural caps with one seeded 512×512 mipmapped water-detail texture. Fine beads are much smaller; its separate runoff channel adds sparse, curved, gravity-aligned trails to vehicle sides/windows and weaker trails along the roof. Hardware filtering removes subpixel sparkle. Glass retains its global thin-sheet optical clarity and .003 roughness.
- Reduced water-film pigment darkening and removed deep pool tint. Low spots remain flat patches on the existing road geometry, with subdued highlights rather than black puddle shapes or mirror sheets. No depth overlays are added.
- Bark, wood, foliage and metal retain appropriate wet colour/roughness changes, but do not evaluate the car's bead texture. Cabin protection and saver/reduced-motion behaviours remain.

## Verification

All 16 test suites passed, including seeded water-map coverage and trail-direction checks. Build replayed 40 official solutions. Thirteen dry/wet views, car closeups, roads, reflection-light angles, overhead, mobile and saver passed with no browser errors; images inspected for bead scale, runoff, asphalt grain, clear cabins and absence of dark pool patches. Native rain-mode mouse/touch wins, low-angle exit, replay, reduced motion, editor trial return and official next level passed.

The inspection also uses real right-button pointer input to orbit the camera in both day/rain modes and confirms the camera actually rotated. Diagnostics and screenshots are included here; user local storage was restored after testing.

| Headless Chrome profile | CPU median | GPU median / p95 | Draw p95 |
| --- | ---: | ---: | ---: |
| Dry idle scene | 1.40 ms | 16.55 / 19.99 ms | 100 |
| Rain idle scene | 1.20 ms | 18.72 / 19.96 ms | 102 |
| Rain mobile viewport | 1.20 ms | 17.64 / 19.27 ms | 102 |
| Dry camera orbit | 1.30 ms | 13.58 / 14.44 ms | 100 |
| Rain camera orbit | 1.50 ms | 15.42 / 16.28 ms | 102 |

Idle remains at 30 FPS, with zero idle shadow updates and zero offscreen frames. Ground reflection captures/passes are zero. The extra two rain draw calls are existing cafe spill/runoff effects rather than another scene render.

## Native gameplay comparison

Same mouse/touch/official-level test flow; previous saved rain-world revision compared to this revision (300 timing samples each):

| Metric | Previous rain-world | Current |
| --- | ---: | ---: |
| CPU median / p95 | 3.90 / 8.50 ms | 1.70 / 2.50 ms |
| GPU median / p95 | 25.01 / 28.64 ms | 19.55 / 24.41 ms |
| Draw median / p95 | 170 / 265 | 116 / 145 |

GPU median improved about 22% in these separate runs; frame windows and desktop GPU load can vary, so this is a directional result, not a controlled hardware guarantee. Native gameplay timing includes moving vehicles, their bounded light-shadow updates and the exit sequence. It does not guarantee sustained 60 FPS. Mobile view is desktop emulation, not physical iPhone/Android hardware; actual phone feel still needs user verification.
