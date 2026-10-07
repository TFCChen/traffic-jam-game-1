# More readable residual rain

Version `06191452`, following `9e4aedd4`. Responds to the ambient water effects being too hard to notice.

## Changes

- Individual outlet/leaf cycles shorten from 19.3 to 10.9 seconds with staggered starts. Beads hang for .60 rather than .32 seconds.
- Dynamic droplets use a brighter pale water colour, alpha .90 rather than .62, 25% larger released radius and a longer falling silhouette. Existing static car water beads and glass/paint are unchanged.
- Each impact produces three short ballistic fragments beside the receiving surface, as well as a fading wet spot. Thirty-five fixed instances replace fourteen in the same single mesh/draw; geometry is never allocated per impact. Sparse source events remain bounded by the 90-second simulation check.
- Narrow curb films have clearer moving normal waves and a smoother optical response. No bright emissive rings, road-centre overlays, extra lights or reflection renders are introduced. These are authored water-film waves rather than fluid simulation.
- Dry, saver, reduced-motion and editor modes continue to disable/freeze the effects. Particle raycasting remains disabled.

## Evidence

All 16 suites passed. The atmosphere suite additionally checks actual splash instance opacity and matrix positions: fragments become visible at an impact and remain close to its receiving surface. Build replayed all 40 official routes.

`motion/inspection.json` and bead/fall/impact screenshots cover canopy and real leaf sources, normal viewing, running gutter time and all disable modes. `ground/inspection.json` covers 13 WebGL views, desktop/mobile framing, native theme selection and real right-button orbit. Screenshots were visually inspected: the impact has separated short fragments and the gutter reads as a narrow moving water strip. A still image cannot establish how noticeable the animation will feel during play; far-away droplets remain small.

| Desktop Chrome profile | CPU median | GPU median / p95 | Draw p95 |
| --- | ---: | ---: | ---: |
| Dry idle | 1.40 ms | 16.92 / 19.61 ms | 100 |
| Rain idle | 1.80 ms | 16.08 / 21.28 ms | 102 |
| Rain mobile viewport | 1.30 ms | 15.20 / 16.33 ms | 102 |
| Dry orbit | 2.20 ms | 14.74 / 19.29 ms | 100 |
| Rain orbit | 2.40 ms | 16.36 / 18.54 ms | 102 |

Previous rain orbit measured 16.25 ms median in a separate run; this run is comparable, not a controlled hardware comparison. The new fragments remain in one draw and no additional scene reflection is performed. Mobile viewport is desktop emulation, not physical phone testing. Idle remains 30 FPS with no idle shadow updates or offscreen frames.

Native mouse/touch dragging, wins, low-angle exit, replay, reduced motion, trial return and official next level are checked by `gameplay/results.json`. Test storage is restored after each browser check.
