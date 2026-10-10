# Layered vehicle paint and retained surface response

Passenger cars now use a slightly metallic pigmented base under a smoother
clearcoat. The racer has a stronger metallic base; commercial vehicles retain
a less metallic and slightly rougher utility coating. High/standard/saver
clearcoat strengths are 0.92/0.55/0, with quality changes applied live.

Trim batching retains roughness and metallic response per vertex instead of
averaging polished metal, rubber and plastic into one material. Handles, rails
and grilles use satin silver; rubber remains rough and nonmetallic. Authored
wheel colours identify alloy versus rubber before rolling: the alloy is neutral
silver, with its own roughness and metallic response. Both remain in the same
rolling batch, including the existing suspension and shadow deformation.

This is a stylized PBR coating, not a multilayer spectral paint simulation or
dynamic ray-traced reflection. It uses the existing environment and lights,
without new geometry or additional render passes.

Verification: all nine model close-ups, actual right-button orbit, vehicle drag
and undo, and mobile layout passed (`../glazing-structure-2026-10-06/`). The
nine-car orbit fixture retained 100 draw calls and 206,480 triangles. GPU timer
medians were 20.33 ms high and 19.86 ms standard in that fixture; these are not
physical-phone FPS results or a performance-improvement claim.

`verify-vehicle-finish.mjs` exercises actual quality buttons in day, sunset and
neon, verifies runtime coating parameters and preserved glass clarity, and
records no runtime/console errors. `npm test` checks all nine models' retained
metal response, distinct wheel/rubber response, geometry and quality transitions.
Production build replays all 40 official solutions. `offline.json` records final
PWA update/cache recovery, offline model loading and preserved game progress.
