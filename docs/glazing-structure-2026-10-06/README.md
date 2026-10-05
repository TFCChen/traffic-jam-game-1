# Clear moving glazing and credible window structures

## Rendering

Camera gestures and vehicle dragging previously reduced the transmission buffer
to 20–30% resolution. Refraction now stays at full resolution throughout motion.
All vehicle windows use a polished 0.003 roughness and a thin 4 mm optical layer.
The restrained tint uses absorption/base colour rather than roughness blur.
High and standard retain physical transmission and Fresnel/environment reflection;
saver retains clear alpha glazing without the refraction framebuffer.

Thin panes have explicit front/back faces with reversed normals. This preserves
visibility from both directions while avoiding the renderer's extra DoubleSide
volume pass and framebuffer resolve. Glass resolution is never reduced by motion.
This is a thin-window approximation; it does not simulate multilayer laminated
glass or recursively refract other transparent panes.

## Models

- Coupe, passenger cars, taxi, pickup and motorhome: separate front and rear side
  panes with opaque structural B pillars occupying real gaps in the glazing.
- Mirrors attach to lower door/body bases with independent support arms, including
  the commercial vehicles; reflective lenses remain outside the cabin.
- Coach and school bus: carved entry opening/stairwell, solid lower door panels,
  framed upper panes, seals, handrail and recessed treads reaching the aisle floor.
  Entry doors sit behind the front wheels. Passenger seats and decorative strips
  avoid the opening.
- Motorhome: framed entry door with a cut living-wall/floor recess.

The editable Blender source and all nine vehicle GLBs were regenerated.

## Verification

`npm test` includes ray checks for visible B pillars, solid bus lower door panels,
and entry cavities without exterior paint immediately behind the glass. Existing
footwell, wheel, material, camera, storage and game checks pass. Production builds
replay all 40 official solution routes.

`scripts/verify-glazing-structure.mjs` runs against an isolated browser without
service-worker bypass. It reviews nine vehicles from side and front angles,
captures entrance close-ups, verifies polished transmission during real right
mouse orbit, and checks a real car drag, move count and undo. A 390×844 emulated
mobile layout has no horizontal overflow; this is not a physical phone test.

Screenshots and the final JSON report accompany this document. Tests restore the
isolated browser's game storage afterward. `gpu.json` identifies Intel UHD Graphics
via ANGLE/D3D11. At 1440×950, DPR 1, the nine-car orbit measured about 23 FPS high
and 24 FPS standard after the thin-pane optimization, versus about 20/22 before.
Median draw calls fell from 172 to 163. Full-resolution transmission remains a
GPU cost on this integrated GPU; these measurements are not a 60 FPS guarantee.

The production offline test also confirms that the current snapshot can recover
from a legacy worker, load its versioned racer model without network access, and
preserve progress. See `production-offline.json`.
