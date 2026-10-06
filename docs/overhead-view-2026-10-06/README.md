# Vertical play view

The play preset, fresh preferences and viewport reset use yaw 0°, pitch 90°,
zoom 100%, with zero pan/focus offsets. The pitch slider now permits 90°.
The display preset remains an oblique inspection view.

An explicit yaw-aware camera up vector avoids lookAt's vertical singularity.
It keeps the lot upright at 90° and preserves continuous yaw rotation. The
fixed reference framing camera uses the same orientation convention.

Unmodified legacy 60°/-12° and 70°/-12° play presets migrate to the new view.
Custom camera positions and quality/light/motion preferences are preserved.

`npm test` includes vertical projection axes at multiple yaw values and extended
clipping checks up to 90°. The production build replays all 40 official routes.
`scripts/verify-overhead-view.mjs` checks the old preset migration, exact screen
alignment of board axes, both presets, slider, reset and a real right-button orbit.
A real car drag increments moves; undo restores the board. Desktop and 390×844
emulated mobile screenshots accompany the report. No service-worker bypass is
used and the isolated browser's storage is restored afterward.

PWA update behavior is unchanged: production registers/checks `/sw.js` when the
application mounts; complete offline snapshots activate automatically and an
existing controlled page reloads. Updates require network access and publishing
to the same installed origin. A deployment-specific immutable Vercel URL does
not follow later releases; use the stable branch/domain URL instead.
