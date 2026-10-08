# Passenger models and exit refinement — 2026-10-08

Final release: `77ec9618`. Baseline: `acf4021` / `8b8789ef`.

## Moving-car shadow correction

The car advanced every render while sun depth was throttled to 30 Hz and headlight depth to 20 Hz. On intervening frames, the moving receiver could therefore sample its own shadow at a previous position. Visible, non-reduced-motion exit now refreshes both maps with the current pose each rendered frame. Idle and normal puzzle interactions retain their cached/throttled shadow policy; no shadow resolution or fixed fence geometry changed.

The baseline recording had 131 shadow refreshes over 245 rendered frames during the sampled visible-motion interval. Fixed day had 266/266 and fixed sunset 255/255. Selected recorded frames were inspected without observing large black body patches. This addresses the demonstrated shadow timing mismatch; it does not prove absence of every possible visual artifact on other GPUs or viewing angles.

## Exit motion

- Fifth-order speed transitions: ease out, settle through the turn, accelerate after steering begins to unwind.
- Longer smooth curvature ramp, retaining Ackermann steering and rear-axle tracking. Conservative fence and street footprint checks pass.
- Cornering body roll follows speed squared and curvature, capped at 0.016 rad before the player's motion strength.
- Deterministic path speed drives suspension rather than dividing traveled distance by a clamped frame delta.
- Camera follow persists while the car is visible. It returns to the saved viewpoint behind the fully opaque cut.
- Removed floating celebratory confetti; replay, result timing, trial return and reduced-motion behavior remain supported.

## Compact / jeep models

Both now have body openings, hollow bezels, inset reflector backing and clear lamp covers. Lens/reflector locations are inset to meet the fascia, and lamp anchors follow the actual new optics. Intake surrounds are hollow with recessed radiator backing: three horizontal slats on the compact and five satin vertical bars on the jeep. Updated standalone editable sources: `art/compact.blend` and `art/jeep.blend`.

| Asset | Triangles before → after | GLB bytes before → after |
| --- | --- | --- |
| Compact | 30,206 → 30,932 | 962,480 → 989,872 |
| Jeep | 30,774 → 31,328 | 982,032 → 1,002,768 |

Each clear headlamp-cover material adds one transparent draw for that vehicle. All non-optical additions reuse existing trim batches. Racer GLB and courtyard GLB are unchanged.

## Verification and evidence

All 16 test suites and production build pass; 40 official routes are precomputed and replayed. Added checks cover per-frame cinematic depth refresh with idle caching, continuous speed/steering, capped cornering load, camera restoration under the cut, passenger optical depth and recessed intake gaps.

- `before/exit.mp4`: prior actual native-mouse exit.
- `after-day/exit.mp4`, `after-sunset/exit.mp4`: corrected native-mouse exits, reconstructed at 30 fps from timestamped browser screencast frames; accompanying PNGs retain full screenshot detail.
- `*/inspection.json`: pose/steering/velocity, rendered-frame and shadow counts, profiling data. `recording-frames.json` references ignored local raw captures and is an encoder input, not a portable image collection.
- `passenger/*.png`, `passenger/inspection.json`: final compact/jeep day/sunset optics and native drag/undo checks.
- `gameplay/results.json`, `gameplay/*.png`: desktop/mobile/low-angle wins, steering, uninterrupted exit, replay, reduced motion, trial return, and official next level. These checks and exit recordings preceded only the final passenger bezel inset; passenger checks and all asset tests were repeated after that correction.

Screen capture itself affects timing. Isolated single-car day GPU median rose from 10.91 to 13.87 ms (p95 14.05 → 14.76 ms); corrected sunset median 13.94 ms. These figures include changing camera visibility and more shadow passes; they are not controlled whole-game FPS comparisons. Native official-board checks also record performance in `gameplay/results.json`. Mobile is viewport/touch emulation on this Windows GPU, not physical-phone hardware validation.

Reproduce recordings with `scripts/record-exit-refinement.mjs`; encode its generated frame manifest with Blender's built-in H.264 encoder:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python scripts/encode-exit-mp4.py -- docs/exit-refinement-2026-10-08/after-day/recording-frames.json docs/exit-refinement-2026-10-08/after-day/exit.mp4
```
