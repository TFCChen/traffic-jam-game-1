# Courtyard hardscape refinement — 2026-10-08

Verified build: `f8890f63`.

- Completed cafe back and end elevations with staggered brickwork, limestone corners/plinths, a recessed service door, threshold and handle.
- Added roof gutter, mounted downpipe and a compact vent; added bench footplates and fasteners.
- Replaced seven solid planter boxes with genuinely hollow stone rims. Earth tops are at 0.1805, below the 0.195 rim tops. Regression rays verify both the recess and open center.
- Preserved eight fence, vegetation, road and foundation mesh signatures. Existing perimeter and shadow geometry checks pass.

The editable Blender source and exported GLB are both committed. `scripts/refine_courtyard_details.py` reproduces the incremental geometry. GLB size increased from 4,574,352 to 4,922,292 bytes, within the existing 5 MB budget; environment geometry increased from 139,676 to 144,492 triangles. Added pieces reuse existing material batches; no additional scene lights or reflection passes.

## Verification

All 16 test suites and the production build pass. The build precomputes and replays all 40 official solutions. Browser checks cover cafe front/back/end, benches, normal/overhead views in day and sunset, rain/night, mobile viewport, saver quality and native right-button orbit. Native mouse/touch gameplay checks cover wins, continuous exit, replay, camera restoration, reduced motion, trial return and official next level. Runtime error collection is empty.

Captured evidence: `views/inspection.json`, `views/*.png`, `gameplay/results.json`, and `gameplay/*.png`.

| Profile | Draw calls | GPU median ms (previous → current) |
| --- | ---: | ---: |
| Day idle | 100 | 16.78 → 16.77 |
| Sunset idle | 101 | 17.54 → 16.96 |
| Mobile viewport, sunset | 101 | 14.65 → 14.39 |
| Day orbit | 100 | 13.17 → 13.26 |
| Sunset orbit | 101 | 14.42 → 14.46 |

Measurements use hardware Chrome on this Windows computer, sampled in separate runs, rather than a controlled benchmark. Mobile checks emulate viewport and touch input, not physical phone GPU performance. Saver mode returns to idle without ongoing renders (98 calls on its rendered frame). The evidence supports no material regression here, not a promise of identical timing on every device.
