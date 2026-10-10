# Rain material readability revision

Version `32d578de`. This replaces the visually weak `1119b6e1` revision. Visual acceptance is not inferred from passing automated tests.

## Implemented

- Smaller standing-water footprints, with the two broad road-centre pools moved to narrow curb-side drainage areas. Water remains part of the road shader, with no floating transparent overlay and no road depression.
- Rain-only HDR overcast environment, with bright clouds correctly in the upward hemisphere. Its diffuse contribution is restrained separately from its optical reflection so asphalt is not washed white. Dry themes use the original environment.
- Wet asphalt retains grain/bump detail and a broad rough lobe (.36 target), while paving (.25), stone (.44), markings (.29), and shallow water (.105) have different roughness. Water locally smooths the road normal; there is no planar mirror pass.
- Removed residual ripple rings that produced unnatural bright outlines. Shallow water uses soft, irregular mask boundaries and view-dependent cloud highlights.
- Vehicle water detail has stronger local normal/roughness response and modest pigment contrast. Bead texture scale is .95 repeats per model unit; sparse thin gravity-aligned runoff remains attached to the moving body. Glass retains its overall optical transparency and low roughness.
- No new scene captures, draw calls, per-frame texture baking, or per-droplet meshes.

## Evidence

All 16 test suites passed; production build replayed all 40 official solutions. `inspection.json` contains the final 13-view WebGL inspection, native settings selection, idle checks and real right-button camera orbit measurements. Screenshots were reviewed for ordinary viewing, road closeup, car closeup, overhead and mobile-size composition. The closeup shows beads and vertical trails; ordinary viewing remains subtler than closeup. These are observations, not a claim that the user's realism target is already met.

| Desktop Chrome profile | CPU median | GPU median / p95 | Draw p95 |
| --- | ---: | ---: | ---: |
| Dry idle | 1.10 ms | 16.74 / 20.20 ms | 100 |
| Rain idle | 1.20 ms | 16.23 / 19.41 ms | 102 |
| Rain mobile viewport | 1.30 ms | 16.08 / 17.87 ms | 102 |
| Dry orbit | 1.30 ms | 13.33 / 13.85 ms | 100 |
| Rain orbit | 1.40 ms | 15.02 / 15.40 ms | 102 |

Idle is 30 FPS, with no idle shadow updates or offscreen frames. Separate benchmark runs vary; mobile viewport is desktop emulation, not physical phone testing. There is no demonstrated phone-frame-rate guarantee.

## Limits

Ground reflections show an authored sky environment, not a reconstruction of nearby buildings, trees and moving vehicles. Material roughness and water masks are authored approximations, not measured BRDF data or a fluid simulation. Reflection remains view-dependent and water details become subpixel at distant views. High-end rainy-street realism is still an art/rendering target, not established by the above checks.
