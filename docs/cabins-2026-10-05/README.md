# Tailored vehicle cabins and low-angle camera repair

New scene settings default to high (精緻) quality. Existing saved manual quality choices remain intact.

All nine editable vehicles have contoured upholstered seats, fitted centre inserts, piping, cushion tailoring, supported headrests and seatbelt buckles. Passenger cars also gain padded door inserts, armrests, release handles, window switches and speaker grilles. The cockpit contains a swept dashboard, inset louvred vents, instrument hood and gauges, infotainment glass, climate dials, a three-spoke steering wheel, cupholder recesses and a padded console. Rear benches, bus passenger seats and the motorhome lounge receive matching upholstery; colours distinguish sporty, utility and commercial interiors. Duplicate old delivery-truck cushions were removed.

Cabin palettes use vertex colours and one shared material. Runtime merging now preserves existing vertex colours instead of replacing them with the material's base colour. The interior forms one batch per vehicle, receives exterior shadows and avoids casting unnecessary fine-detail shadows.

The former orthographic camera sat only 14 units from its movable orbit target. Panning and then rotating at a low angle could put the parking lot behind its near clipping plane, cutting it along a straight line. The camera now sits 200 units away, with a 400-unit far plane. Orthographic projection preserves apparent size and the existing viewport-centred orbit behaviour. Mathematical regression checks cover all pitch limits, 30-degree yaw intervals, extreme saved focus offsets and every corner of the 200-unit ground.

## Verification

- `npm test`: model fit, exported upholstery and preserved batch colours, puzzle engine, suspension, storage, camera and scene unlock checks pass.
- `npm run build`: passes, including replaying all 40 official routes and generating the offline snapshot.
- `node scripts/verify-cabins.mjs <CDP URL>`: fresh high-quality defaults, nine-car glass quality modes, daylight/sunset/neon close-ups, actual right-button orbit at 400%, 30-degree orbit at 65% with large focus offsets, legal vehicle drag and undo, live quality switching and a 390px mobile viewport.
- `verification.json` records actual measurements in the nine-car showcase on desktop Chrome at 1440 × 950. These are local measurements, not device-wide performance guarantees. New geometry has a measurable GPU cost. In a same-session old/new asset comparison using the current renderer and nine cars, high quality averaged 29.0 versus 27.8 FPS; GPU medians were 24.5 versus 28.2 ms. Other open previews and system load were not disabled. Do not compare these directly with previous-session FPS.

Actual iPhone/Android hardware remains untested. This remains a stylised, lightweight vehicle cabin, not an interactive automotive simulator. Editable source is `art/toy-garage.blend`, reproduced by `scripts/build_models.py`.
