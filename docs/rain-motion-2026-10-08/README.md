# Occasional residual rain motion

Version `9e4aedd4`. Adds small ambient movement to the accepted rain-material baseline `32d578de`; vehicle glass/paint and the sky reflection treatment are retained.

## Behaviour

- Three cafe canopy outlets and four leaf-tip sources. Leaf sources are selected from the shipped foliage geometry, outside the puzzle; their wind profiles follow the same deformation as the leaves. Released drops fall under scaled gravity rather than continuing to sway with the branch.
- Staggered releases over a 19.3-second cycle. Each source briefly forms a bead, falls to a raycast receiving surface, then shows a small flattened fading impact. A 90-second simulation checks sparsity, attachment, bounds and impact lifecycle.
- Fourteen reusable instances in one mesh replace the previous six canopy-only droplets. No mesh allocation per release, lights or animated shadow refreshes are added; particles cannot intercept picking.
- Road-edge water-film detail scrolls slowly in two narrow gutters at x=6.79 and 9.77, outside the puzzle. It uses the existing grain texture and a small normal perturbation, with no overlay geometry, illuminated rings or extra reflection captures.
- Rain detail is disabled in dry themes, saver quality, reduced motion and the editor. Disabled particle/flow clocks do not advance. Existing offscreen scheduling pauses the scene.

## Verification

All 16 test suites passed; build precomputed/replayed 40 official routes. `inspection.json` records actual WebGL bead, fall and impact stages at canopy and tree closeups, normal framing, flowing gutter clock, and dry/saver/reduced/editor disable checks. Screenshots were visually inspected. The script waits for the scene transition to finish before capturing the composition.

`ground/inspection.json` covers 13 dry/wet, close/normal, overhead, mobile and saver views plus native right-button camera orbit. `gameplay/results.json` covers native mouse/touch wins, low-angle exit, camera restoration, replay, reduced motion, editor trial return and official next level. No browser exceptions or console errors were recorded. Test storage was restored.

| Desktop Chrome profile | CPU median | GPU median / p95 | Draw p95 |
| --- | ---: | ---: | ---: |
| Dry idle | 1.30 ms | 14.14 / 14.65 ms | 100 |
| Rain idle | 1.80 ms | 16.62 / 20.29 ms | 102 |
| Rain mobile viewport | 1.70 ms | 15.43 / 15.76 ms | 102 |
| Dry orbit | 2.50 ms | 14.05 / 14.70 ms | 100 |
| Rain orbit | 2.60 ms | 16.25 / 21.38 ms | 102 |

Rain remains at 102 draws, matching the prior revision; ground reflection passes remain zero. Idle is 30 FPS with no idle shadow refresh or offscreen rendering. Frame timing varies with desktop load; mobile viewport is desktop emulation, not a phone FPS guarantee. The rain shader adds one grain lookup on wet asphalt, so this is bounded additional work, not a zero-cost effect.

## Visual limits

Drops and impact patches are tiny, especially in normal/phone framing. They are intended to reward looking at the cafe and trees while thinking, not cover the puzzle with rain. Gutter detail is an authored water-film animation, not fluid simulation. Impact receiving height is determined once from static street geometry; it does not simulate moving-object splashes.
