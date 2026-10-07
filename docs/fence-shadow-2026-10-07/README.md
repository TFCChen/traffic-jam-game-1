# Fence perimeter shadow repair — 2026-10-07

Build: `a7b56334`.

The original camera orbit reproduced shifting dark hatch marks around the lot's fence, although the shadow update counter stayed unchanged. Disabling shadows removed them. The directional light used Three's default 0.5–500 depth range and a negative depth bias: a normalized -0.0002 offset corresponds to roughly -0.1 world units, large relative to the 0.022-unit rails.

The sun now uses a fixed 1–32 depth range, positive 0.00015 bias (0.00465 world units) and 0.008 normal bias. Shadow texture sizes and refresh cadence remain unchanged. Four corners also had duplicate shoes, posts and caps: 12 overlapping components were removed from the Blender source and exported GLB; the generator now shares endpoint posts.

- [Original orbit artifact](old-artifact.png) / [fixed identical camera](fixed-same-view.png).
- Native browser input: right-button orbit, middle-button pan and wheel zoom in day/high, day/standard, sunset/high and neon/high. [Inspection](inspection.json) records actual changed camera settings; all four runs had zero shadow updates during camera movement.
- Two-finger pan/pinch at 390×844 also passed with zero shadow updates. This is Chrome device emulation, not a physical iPhone/Android test.
- Screenshots before/orbit/after were reviewed for fence bands and retained vehicle/street shadows. No browser runtime or console errors.
- `npm test`: all 13 test modules passed. New asset regressions check all scene bounds against the sun's depth interval at 15-degree light increments, and check exported corner triangles for exact overlapping faces.
- `npm run build`: 40 official solution routes replayed; production build and offline snapshot generated.

Reproduce using `node scripts/verify-fence-shadows.mjs <isolated Chrome browser CDP websocket>`. Fixtures restore local storage afterward. This repair targets the reproduced broad self-shadowing bands; it does not claim to remove all subpixel aliasing from thin rails on every device.
