# Thin vehicle glass render optimization

The previous transmission material rendered every opaque object twice to build a screen-space refraction buffer for four-millimetre vehicle panes. Thin-sheet glass now blends over the existing opaque scene. It retains physical direct/environment specular reflection, Fresnel reflection at grazing angles, angle-dependent tint absorption, two visible optical faces and clear views of the existing cabin. Its tiny refractive image displacement is approximated by a straight-through view. It does not blur or lower resolution during camera/vehicle motion.

The refractive reference path is retained only for development diagnostics. The development inspection hook can switch glass modes or temporarily hide panes without changing persisted player settings. The production UI continues to use the same quality levels.

In the same nine-model desktop fixture, the median GPU cost changed from 51.61 ms to 26.12 ms (49% less), renderer submission CPU cost from 5.5 ms to 2.3 ms, draw calls from 180 to 100 and triangles from 409,956 to 206,480. The new renderer's isolated refractive reference measured 52.91 ms, confirming the shared transmission pass is the main removed cost. These timers are asynchronous GPU queries, not wall-clock estimates.

Automated visible-frame rate remained around 9–10 FPS in this environment, despite the GPU improvement. A separate raw requestAnimationFrame probe returned 19 callbacks in 2.054 seconds (9.25 Hz, document.hidden=false), recorded in cadence.json. Browser callback delivery is also slow here; these results cannot establish physical-phone FPS or promise 60 FPS. The phone should be evaluated by the player with this release. No automatic quality reduction or pixel-resolution changes ship in this optimization.

`before.json` and `after.json` record the comparative profiling fixture. `baseline.png` shows thin sheets; `refractive-reference.png` shows the old reference. `scripts/verify-glazing-structure.mjs` captures all nine models enlarged at front/side angles, orbit and drag checks, and mobile emulation. Existing engine/model/light/camera tests and the production PWA offline/update checks cover regressions.
