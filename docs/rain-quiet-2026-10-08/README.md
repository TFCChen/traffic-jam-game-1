# Quiet residual rain

Version `bb96917e`, following `66ce603d`.

- Removed the continuous straight curb film, animated normal waves and simulation clock. Accepted wet materials, puddle masks and reflections remain unchanged.
- Drops still hang on real canopy/leaf sources, then fall occasionally. Solid paving/soil landings now end the drop without expanding discs or splash fragments. Existing sources do not land in standing water, so no ripples are fabricated there.
- Fixed instances reduced from 35 to 7 in the same single draw. No new lights or reflection passes.

All 16 suites passed, including landed-drop opacity, receiving-surface height, sparse events and cleanup. Build replayed 40 official routes. Browser evidence is in `motion/`, `ground/` and `gameplay/`; screenshots cover bead/fall/landing, static curb surfaces, wet/dry materials and mobile framing. Browser scripts verify real orbit and mouse/touch puzzle moves, exit, replay and trial return. Mobile framing uses desktop emulation, not a physical phone. Test browser storage is restored.
