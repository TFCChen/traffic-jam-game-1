# Connected, dense courtyard plants — 2026-10-07

The previous asset randomized leaf locations but left the original straight trunk and five regular spokes. Leaves sampled inside volumes were not actually attached to branches. This produced the user's sparse, floating-leaf and coat-rack observations, including in the planter shrubs.

Plant generation now builds the skeleton first: a tapered, slightly bent leader, major forks from staggered heights, curved secondary branches, terminal twigs and inner shoots. Each leaf's narrow base is placed on one of those modeled twigs. Inner shoots fill the centre of each tree crown. Shrubs grow from stems rooted inside the planting soil and split into overlapping leafy fans. Leaf outlines are six-sided folded almonds with smooth normals.

The focused Blender rebuild removes the old tree components from the shared oak mesh, replaces foliage and creates a dedicated bark batch. Other courtyard geometry is checked for unchanged coordinates/connectivity during regeneration. The shared full-build source uses the same plant generator. The editable `.blend` and web GLB are both saved.

Branches and leaves use the same world-space wind field, including identical displacement at shared attachment points. Root-level wind weight is zero. No per-frame sun-shadow refresh is added.

## Verification

- 10,032 leaves; each base checked against the actual branch centre-line segments during generation. Maximum measured attachment gap: `0.0000007153` world units, below the `0.000001` tolerance.
- Plant geometry: 86,256 triangles including bark; the complete GLB is 4,574,352 bytes, below the existing 5 MB asset budget.
- `npm test`: all 14 suites passed, including matching wind profiles for branch/leaf attachment points and cleanup of both cloned geometries.
- `npm run build`: all 40 official solution routes replayed.
- `verify-foliage.mjs`: old/new close comparison, overhead, side, sunset, night, shrub detail and mobile DPR 3 views. No browser/WebGL errors. Idle 29.5 FPS, no idle shadow refresh, zero offscreen frames.
- `verify-atmosphere.mjs`: moving wind without shadow refresh, live reduced-motion switching, saver quality, daytime/nighttime and mobile viewport profiling passed.

| Whole scene, isolated Chrome | CPU median | GPU median | Draw calls |
| --- | ---: | ---: | ---: |
| Desktop day | 1.8 ms | 15.2 ms | 98 |
| Desktop night | 2.1 ms | 25.5 ms | 99 |
| Mobile viewport, DPR 3 | 1.4 ms | 14.6 ms | 98 |

Compared with the preceding atmosphere measurement, daylight GPU medians are roughly 1 ms higher and there is one additional material draw call. Geometry/download size increased to provide actual stems and denser leaves. Night measurements fluctuate and remain the heavier scene; these runs do not establish a night performance improvement. Mobile size/touch/DPR is emulated on this computer's GPU, not a physical phone benchmark.

Screenshots and inspection JSON record the visual comparisons and timings. Existing falling leaves, cafe lighting, vehicle models, game controls and repaired courtyard foundation separation remain in place.
