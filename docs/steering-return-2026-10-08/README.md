# Progressive steering return

Build `93bab745`, compared with baseline `b5b6a3c` / `86eefc01`.

## References and interpretation

- [MathWorks vehicle kinematics](https://www.mathworks.com/help/robotics/ug/mobile-robot-kinematics-equations.html): rear-axle motion, heading rate related to speed and steering through the wheelbase, and Ackermann wheel directions about a shared turning centre.
- [Continuous-curvature reference paths](https://www.mathworks.com/help/nav/ref/referencepathfrenet.html): matching heading and curvature through connected path segments avoids curvature jumps.

This animation uses low-speed, no-slip geometric kinematics. It does not model
steering torque, tyre forces or hands-off mechanical self-centring. The change
represents a driver progressively unwinding the steering while driving out of
the corner. Its ramps are smooth polynomial curvature envelopes, not exact
Euler spirals or a full dynamics solver.

## Change

The original 0.8-unit curvature ramp unwound very quickly, overlapping the
exit acceleration. The new return ramp spans 1.8 units, with the total turn
length adjusted to preserve a 90-degree integrated heading. Entry uses a cubic
smooth ramp; return uses a quintic ramp. Both have zero endpoint slope.
The speed timeline starts settling earlier and moves the final acceleration
later, to near completion of the unwind.

The rear axle path, body heading and independent front wheel angles still share
one curvature calculation. No steering-only smoothing was added, so tyres do
not lag behind their travel direction. Existing wheel track, hubs, model,
shadow synchronisation and exit duration are preserved.

Sampling both versions at 1 ms intervals:

| Measurement | Before | After |
| --- | --- | --- |
| Maximum inner-front steering angle | 33.69° | 33.69° |
| Peak inner-front return rate | 134.28°/s | 65.84°/s |
| Return interval (rate > 0.01 rad/s) | 3756–4222 ms | 3326–4264 ms |

## Verification

- Exit choreography tests pass: continuous movement, finite speed, wheel return
  rate, fence clearance, road bounds, fade, camera restoration and reduced motion.
- A new check differentiates each wheel's world position along the animated
  path, then compares its velocity direction with the rendered wheel heading.
  Both front and rear wheel errors must remain below 0.012 radians. Both front
  return rates must stay below 1.2 rad/s.
- Production build passes and replays all 40 official solutions.
- `gameplay/results.json` records actual mouse and emulated touch wins, replay,
  low-angle exit, reduced motion, editor trial return and official next level.
- `close-turn/exit.mp4` records the final animation at pitch 23°, zoom 220%.
  Inspected frames 08, 12 and 16 show the turn, unwind and straight departure.
  Runtime exception collection is empty. Physical mobile devices were not tested.

Reproduce the close-up with the dedicated browser CDP websocket:

```powershell
node scripts/record-exit-refinement.mjs $taskWs docs/steering-return-2026-10-08/close-turn day 2.2 23
```

The timestamp manifest points to ignored local raw JPEGs; MP4 and PNG files are
self-contained. Encode via Blender using `scripts/encode-exit-mp4.py`.
