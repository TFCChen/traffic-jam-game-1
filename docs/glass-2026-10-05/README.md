# Glass, cabin and mirror review — 2026-10-05

Vehicle windows now use physical transmission, a refractive index of 1.48, subtle blue tint and low roughness. Standard and high quality share one transmission buffer. During vehicle/camera movement the buffer renders at reduced resolution; it returns to a sharper setting while inspecting the scene. Saver mode keeps transparent reflective windows without a transmission pass.

All nine editable Blender vehicles now contain cabin geometry. Passenger cars have carpeted floors, shaped seats and head restraints, dashboards, consoles, gear selectors and open steering rims. Commercial vehicles retain passenger seating and gain driver seat backs/head restraints and a dashboard/steering rim. Vehicle mirror lenses use a separate metallic material and stay out of the matte trim batch. The coupe mirror mounts sit outside the glazing on exterior sail panels.

Glazing gaskets follow actual perimeter vertices. A pillars follow each sample of curved windshields, with rounded joints; side glazing shares the curved windshield and rear-window contours rather than spanning them with straight edges. Pickup and motorhome cabin contours were also corrected. Engine-cover/solar-panel/display materials remain distinct from transparent cabin glazing.

## Validation

- `npm test`: engine, assets, scene unlocks, suspension, storage and camera suites passed. Added checks for physical glass exports, reflective mirror lenses, real cabin geometry and coupe mirrors outside the glazing.
- `npm run build`: passed, including 40 precomputed/replayed official solutions and the offline snapshot.
- `node scripts/verify-glass.mjs <browser-CDP-URL>`: all nine vehicles checked in standard/high/saver; front/rear/side close-ups, day/sunset/neon screenshots, 390px mobile viewport, legal pointer drag and undo, live quality switching all passed.
- Measurements in `verification.json` were collected in an isolated desktop Chrome session at 1440 × 950, device pixel ratio 1, with all nine vehicles present. Active rendering averaged about 56 FPS (standard), 51 FPS (high) and the configured 30 FPS (saver). Median GPU times were 12.2, 14.3 and 8.9 ms. These are measurements on this computer, not guarantees for other hardware; actual iPhone/Android hardware is untested.

Reflection uses the existing prefiltered environment lighting; this is not ray-traced reflection of other moving vehicles. Interior geometry is designed to look credible from the supported orbit/zoom camera, without occupants or interactive cockpit features.

Editable source: `art/toy-garage.blend`; reproducible generator: `scripts/build_models.py`.
