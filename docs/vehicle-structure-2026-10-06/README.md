# Wheel structure, coupe panel seams and road contact

The red coupe now has recessed rim barrels and brake rotors instead of a flat
hub disk behind its spokes. Recessed upper wheel liners sit behind the tyres and
inside the shell. Bonnet and door shut lines are projected onto the original
coachwork surface; the established vehicle silhouette is retained. Tail lamps
have a dark recessed bezel. Other vehicle families share the new sidewall bead,
alloy rim lip and longer spokes, retaining their different spoke counts.

The existing single contact plane per vehicle now samples a shared two/three-cell
texture with four concentrated tyre contacts plus soft underbody occlusion.
Textures follow the car's actual axle positions and orientation and are disposed
with the scene. This is an artistic ambient-contact approximation combined with
the existing real shadow maps, not full screen-space ambient occlusion.
The resting tyre height is 0.038 above the world origin, just 0.0025 above the
asphalt top; the contact plane stays above asphalt and below the tyres. Picking's
reference plane follows the same resting height.

Editable source: `../../art/toy-garage.blend`; generator:
`../../scripts/build_models.py`. GLB export writes a complete staging file before
replacing the public model to avoid exposing partial exports to localhost.

Verification includes model lane bounds, intact fenders, recessed front liners,
rolling-wheel pivots, material responses, suspension stability, and four tyre
contact patches. Production builds replay all 40 official solution routes.
The glazing browser report includes enlarged front/side views of all nine models,
actual camera orbit, vehicle drag/undo, and mobile layout. Lamp-placement checks
exercise actual movement, braking, reversing and daylight/night emitters.
`verify-ground-contact.mjs` checks the lowest allowed camera angle, actual
one-cell mouse drag, settled suspension and undo. `offline.json` confirms this
release's PWA cache, version check, offline model and level-17 progress recovery.

The nine-car orbit fixture retains 100 draw calls. The added rim and tyre geometry
increases visible triangles from 206,480 to 254,412. Browser timer measurements
are recorded in the updated glazing report; no physical-phone FPS claim is made.
This pass does not change the existing suspension tuning or puzzle collision rules.
