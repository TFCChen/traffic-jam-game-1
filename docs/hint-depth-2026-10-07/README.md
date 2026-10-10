# Grounded hint destination with occluded styling

Per-cell waypoint dots have been removed. The arrow and explicit distance label remain.

The destination footprint has two depth-aware styles sharing the same ground coordinates:

- A bright solid outline uses the regular depth test, so vehicle bodies and fences genuinely occlude it.
- A 28%-opacity dashed outline uses the inverse depth test. It only appears where nearer opaque geometry hides the ground, communicating a view through an obstruction without painting the bright solid outline across the vehicle.

Hidden dashes use one bounded instanced draw, with no additional depth-texture capture or full-scene pass. Geometry, materials and instance storage are reused for the active hint and disposed with the scene.

`scripts/verify-hint-depth.mjs` captures three low-angle directions, overhead and mobile emulation using foreground vehicles that obstruct the destination outline. The screenshots were visually inspected for solid exposed ground and faded dashes over occluding car surfaces. `scripts/verify-fleet-hint.mjs` checks actual hinted dragging and clearing after the rendered frame catches up with the game state. `npm test` and production build pass; the build replays all 40 official solutions. Mobile screenshots use Chromium emulation rather than a physical device.
