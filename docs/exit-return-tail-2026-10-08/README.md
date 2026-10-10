# Later turn with a gentle steering return tail

Build `e7b07746`; baseline `d5df8fc` / `93bab745`.

The rear axle now travels 0.215 additional grid units before entering the turn.
The rear-axle turn start moves from x=6.385 to x=6.60. Radius changes from 2.40
to 2.05, making the turn slightly deeper (maximum inside steering angle rises
from 33.69° to 38.96°) within the existing courtyard road. This is a later,
deeper turn, not a larger-radius turn or a widened map.

The return curvature envelope is `t^4 * (5 - 4t)`, where `t` is remaining
transition distance. Its largest curvature decrease occurs in the first quarter
of the unwind; its long tail has progressively gentler return and zero slope at
straight steering. The return transition spans 2.5 units. Its area is one third
of its length, accounted for in the turn length to retain exactly 90° of total
heading change. Wheel directions still come from the same curvature as the rear
axle path, with the existing Ackermann front track and wheelbase.

The entire cinematic runs at 1.18 times its previous duration: completion moves
from 5.65 to 6.667 seconds. Motion, physically reported speed, camera return and
fade use the same time scale. Reduced-motion completion remains 120 ms.

At 1 ms sampling, the active return interval (rate > 0.01 rad/s) spans
3737–5163 ms, or about 1.43 seconds. Peak inside return rate is 52.37°/s.
Average rates between 60%→30%, 30%→10% and 10%→2% remaining steering are
approximately 48.1, 30.6 and 13.0°/s respectively.

Verification includes:

- Exit geometry tests for continuity, supported-road bounds, fence clearance,
  camera restoration, hidden vehicle removal, reduced motion and completion.
- Four-wheel velocity-direction tests ensure tyres point along their actual
  animated travel direction rather than merely interpolating visual steering.
- Return-tail tests assert progressively decreasing average return rates and
  near-straight steering before the shot ends.
- Production build and replay of all 40 official solutions.
- `close-turn/exit.mp4` and PNGs show actual browser gameplay at 23° pitch and
  220% zoom. Inspected frames 08, 12 and 16 show turning through straightening.
- `gameplay/results.json` records native mouse and emulated mobile touch exit,
  replay, editor trial return, reduced motion and the official next level.
  The verification waits for actual scene fade completion instead of a fixed
  delay, supporting the longer cinematic while retaining the zero-fade check.

No vehicle or courtyard models, lighting settings or shadow policy changed.
Physical phones were not tested in this round. MP4 and PNG files are portable;
the timestamp manifest references ignored local raw JPEGs.
