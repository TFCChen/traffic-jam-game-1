# Stable corner orbit

Version `d7b5ea58`.

The camera used to clamp its pan in the intermediate rotated pose, before compensating the screen-center pivot. Near zoomed corners that clamp fed back into focus, producing abrupt translations. Pan constraints now run for deliberate pan/zoom input, while orbit and subsequent camera refresh preserve the screen center.

Regression browser test: zoom 4, off-center views, pitch 30/55/90, both directions, eight native right-button drags per view (over a full revolution), including yaw wrap and released frames. Before: maximum center displacement 3.5774, 1.5066 and 2.4121 model units. After: center displacement must stay below 0.0001 with unchanged frustum width. Saved browser state is restored.

All 16 suites and build passed; build replayed 40 official solutions. `before/inspection.json` and `after/inspection.json` contain input samples and center measurements. `gameplay/` verifies native mouse/touch moves, low-angle exit, camera restoration, replay, trial return and next level. Mobile checks use desktop touch emulation.
