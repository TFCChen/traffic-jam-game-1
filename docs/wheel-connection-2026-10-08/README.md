# Red car wheel attachment and steering

Local build: `86eefc01`. Baseline commit: `8471689`.

The front hubs move inward from half track 0.430 to 0.405. Authored tyres,
shader pivots, simplified shadow tyres and Ackermann steering all use the same
front track; the rear axle stays at 0.430. Wheels still turn around their own
centres. Steering is not artificially clamped independently of the exit path.

The racer now contains lower wishbone arms, an upper link and an upright at each
wheel. The upright shares the stationary brake batch: it steers with the front
wheel, without spinning with the tyre. Body-side arms stay fixed. These are
visual suspension details, not a full suspension solver or articulated linkage.
A deeper upper liner and dark inner arch wall cover the exposed chassis behind
the tyres. Their height preserves the existing recessed headlamp pockets.

Existing trim and wheel material batches are reused. The racer GLB grows from
1,279,876 to 1,336,380 bytes. Other vehicle models and the courtyard are unchanged.

Verification:

- All 16 test suites passed after the front track and suspension changes.
- The final inner-wall revision passed model ray checks on both sides, wheel
  pivot checks, existing lamp-pocket checks and a production build; 40 official
  routes were replayed during the build.
- `gameplay/results.json` records native mouse and emulated touch wins, replay,
  low-angle exit, reduced motion, editor trial return and the official next
  level. This run precedes only the final inner-wall face/depth adjustment.
- `close-turn/exit.mp4` and PNGs record the final model at pitch 23°, zoom 220%.
  The close-up fixture starts at the exit lane end to keep the native drag
  reachable. Its camera is focused over the street. These are browser captures,
  not offline Blender renders. Inspected frames 08, 12 and 16 show the turn and
  wheel silhouette; runtime exception collection is empty.
- Physical iPhone/Android devices were not tested in this round.

Reproduce close-up capture with a dedicated Chrome CDP websocket:

```powershell
node scripts/record-exit-refinement.mjs $taskWs docs/wheel-connection-2026-10-08/close-turn day 2.2 23
```

The timestamp manifest refers to ignored local raw JPEGs. The MP4 and PNGs are
self-contained. Encode with `scripts/encode-exit-mp4.py` through Blender.
