# Suspension clearance and moving-shadow synchronisation

Build `3ab3a3f7`, baseline `3a36276` / `aff1a17d`.

## Suspension link correction

The previous racer suspension arms were entirely static while the tyre and
upright steered. At full lock the rim swept across the upper link. The authoring
source now assigns links to a dedicated vertex-coloured material so the runtime
can distinguish them before batching. Links do not spin. Their body ends remain
pinned, while their hub ends follow steering, using a per-vertex attachment
weight. Uprights and calipers retain full steering, with no rolling rotation.

The links merge into the existing wheel draw call; simplified tyre shadow
geometry receives the same attribute layout. This is a lightweight visual
attachment deformation, not a rigid multi-body suspension simulation.

Tests cover both front sides at neutral and ±0.70 radians, ensuring articulated
and pinned link vertices remain behind the alloy barrel, instead of cutting
through its centre. Existing rim/tyre, headlamp pocket, body, steering and shadow
geometry checks remain intact. Only the racer GLB and editable Blender source
are rebuilt; other vehicles and courtyard models are unchanged.

## Drag shadow correction

Previously only the cinematic bypassed the 30 Hz sun and 20 Hz headlight shadow
budgets. Native drag and suspension settling could render a changed vehicle
against depth from its previous pose. Now every changed, rendered vehicle pose
submits matching sun and active vehicle-light shadows. Unchanged poses remain
cached. Frame caps and shadow resolution are preserved; moving-frame GPU work
can increase because shadows refresh more often.

Two inspection counters distinguish rendered moving poses and those submitted
with matching sun depth. `scripts/verify-drag-shadow-sync.mjs` performs rapid
back-and-forth native mouse and emulated touch drags in day and sunset themes,
asserts matching counts, then waits for suspension settling before checking
stationary cache reuse. The theme and enabled-shadow settings are asserted.
Its screenshots and counts are saved in `drag/results.json`.

## Verification

- All 16 test suites passed after the linkage/shadow behaviour changes.
- The added attachment-clearance model tests passed after that run.
- Production build passes and replays all 40 official solutions.
- Native mouse and emulated touch fast-drag checks pass, with no unmatched
  moving sun-shadow submissions and cached shadows after settling.
- `turn/exit.mp4` records actual low-angle browser gameplay. Inspected frames
  08 and 12 show the front wheel through the maximum-steering part of the exit.
- `gameplay/results.json` records continuous exit, native mouse/touch wins,
  low-angle exit, camera restoration, replay, reduced motion, trial return and
  the official next level. Runtime exception collection is empty.

Physical phones and their GPU cost were not measured in this round. MP4 and PNG
files are self-contained; raw capture manifests reference ignored local JPEGs.
