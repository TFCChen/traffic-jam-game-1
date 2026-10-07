# Natural courtyard foliage — 2026-10-07

The previous generator placed large leaves on Fibonacci sphere surfaces (`angle = index × 2.39996`). From close viewpoints their spacing and tangent alignment revealed concentric spiral bands. The six overlapping spherical clusters also made each tree look like the same solid clipped ball.

The new Blender generator uses independent seeded samples throughout irregular ellipsoidal branch volumes. Each tree combines a filled core with seven uneven terminal masses at different heights. Leaves are smaller, have varied orientation and clustered colour variation. The resulting crown has an uneven outline and visible internal gaps rather than an ordered outer shell. Planter foliage uses the same unordered distribution.

`scripts/courtyard_foliage.py` is shared by the full environment build and a focused rebuild script. The focused rebuild preserves all non-foliage geometry and checks its SHA-256 signature before/after. The editable Blender scene and exported GLB are both updated.

- Foliage: 17,040 triangles, kept in one material batch.
- Environment GLB: 3,046,388 → 2,865,488 bytes (about 5.9% smaller).
- All 14 test suites passed; all 40 official solution routes replayed during build.
- Browser comparison uses the previous committed GLB intercepted only in the isolated test browser, then reloads the actual new model.
- Close, overhead, side, sunset, night and mobile DPR 3 views passed without browser errors.
- Idle: 30 FPS, zero extra shadow updates; offscreen: zero rendered frames.

`before-close.png` and `after-close.png` show the same close viewpoint. Other screenshots and `inspection.json` record the remaining views. Existing micro-wind, falling leaves, static shadow proxies and the repaired courtyard depth separation remain enabled.

Mobile verification emulates screen size and DPR on the desktop GPU; it is not a physical phone benchmark.
