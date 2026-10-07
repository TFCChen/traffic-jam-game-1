# Rain-after world materials

Release version: `bf7acf2e`.

## Reference study

- [Real bonnet water beads](https://www.ftecq.co.jp/sub1_241.html): irregular droplets on curved paint rather than evenly distributed white dots. [Real window droplets](https://unsplash.com/photos/rain-drops-on-the-window-of-a-car-00lywQVV1S8): clear spaces between attached beads.
- [Far Cry 6 official weather article](https://www.ubisoft.com/en-us/company/how-we-make-games/technologies/articles/simulating-tropical-weather-in-far-cry-6) and [GDC session](https://gdcvault.com/play/1027675): coherent wet states for static props and dynamic assets, shelter masking, terrain puddles and ripples. These informed material-specific wetness and protection of cabin/sheltered surfaces.
- [Driveclub wet-racing screenshot](https://www.gamesradar.com/driveclub-guide/) and [Forza Horizon 5 screenshot gallery](https://steamcommunity.com/app/1551360/screenshots/): visual references for the combination of glossy vehicles, beads and reflective roads. Racing-storm effects are reduced to quiet residual runoff for this stationary puzzle scene.
- [Epic clearcoat and thin-glass shading](https://www.unrealengine.com/tech-blog/improved-shading-models-in-unreal-engine-4-25-and-beyond): distinct top-layer optical normals and preserved tinted transparency.

## Implementation

- `rainSurfaces.js` composes existing material shaders instead of replacing glass absorption, per-part finishes or tree wind. Attached, irregular triplanar bead normals stay with cars during movement. Screen-footprint fading suppresses tiny distant sparkles; wet leaf/bark/wood/metal responses differ from painted bodywork. Car cabin upholstery is excluded; exposed trim is geometrically masked and the cafe service area is sheltered. Wetness is authored exposure, not a general rain-occlusion ray-cast system.
- Glass retains its existing .003 roughness, alpha/Beer-Lambert tint and single-pass thin optics; water beads affect local reflection normals, not global blur or fogging.
- Six instanced canopy drops add residual runoff outside the puzzle. Puddle wave crests gently perturb the water-film normal. Reduced-motion, editor and saver disable animated runoff/ripples; saver omits bead detail.
- Puddles now share a real 512×512 planar scene reflection. No visible mirror plane is added. Terrain is hidden during the capture to avoid texture feedback, and shadow maps are reused. Camera/car changes request an update, capped to roughly 30 captures/s; idle refreshes at most once per 650 ms. Saver uses sky/light reflection only. This intentionally adds GPU work over the prior sky-only implementation.
- Reflection GPU timing and draw counts are included in the profiler. Main wet render is 102 calls; capture frames can be about 199 calls. This is a cached planar reflection, not full ray tracing, fluid simulation or a volumetric weather engine.

## Verification

- All 16 test suites passed; build replayed all 40 official routes.
- Thirteen dry/wet, enlarged-car, road, reflected-sun, cafe, night, overhead, mobile and saver views passed with no browser exceptions. Wet-mode selection works with no completed levels. Screenshots inspected for droplets, transparent cabins, mirror alignment, vehicle readability and water highlight aliasing. An initially bright, jagged ripple was corrected with a softened, screen-filtered wave crest.
- Native mouse and touch rain-mode wins, low-angle exit, camera restoration, replay, reduced motion, editor trial return and official next level passed (`gameplay/results.json`). User storage restored after checks.

| Profile | CPU median | GPU median / p95 | Draw median / p95 |
| --- | ---: | ---: | ---: |
| Dry desktop | 1.70 ms | 14.35 / 15.88 ms | 100 / 100 |
| Wet desktop | 1.70 ms | 19.82 / 21.51 ms | 102 / 199 |
| Wet mobile viewport | 1.70 ms | 18.82 / 21.72 ms | 102 / 199 |

Idle measured 30.5 FPS under the 30 FPS scheduler with zero shadow updates and zero offscreen frames. Mobile viewport is desktop Chrome emulation (393×844, renderer pixel ratio 2), not physical iPhone/Android hardware; these values do not guarantee sustained 60 FPS. Gameplay was verified before the final purely visual trim/ripple refinements; the final 13-view inspection and tests cover those refinements.
