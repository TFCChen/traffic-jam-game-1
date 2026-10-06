# Lens placement and lamp timing — 2026-10-06

The moving lane marker is removed from gameplay. Editor placement/conflict markers remain available.

Each model has two actual headlight and two tail-lens anchors. GLTF combines same-material surfaces into single meshes; anchors are extracted from exterior lens vertices on each side, rather than the material mesh's combined bounding-box center. Roof signs, safety markers and interior red buckles are excluded. Points follow the body, suspension and vehicle rotation. Headlights now emit individually from those lenses. Two soft visible cone meshes sample the real headlight depth maps so obstacles also interrupt the visible beams. These are lightweight atmospheric approximations, not volumetric ray marching.

Dedicated small white reversing lenses are installed under the red tail lenses and follow the same body motion. Red-lens emission is masked to the rear exterior region so red interior details and front bus markers do not glow with brake input.

## Lamp policy

| State | Headlights | Red rear lenses | Reversing lenses |
| --- | --- | --- | --- |
| Parked, never selected | Off | Off | Off |
| Daytime forward input | Visible daytime lens glow (.75 emission); no headlight projection | Off | Off |
| Dusk/night input | Two forward beams | Dim position light | Off |
| Reversing | Day/night policy retained | Dim at night; no brake brightness merely for reversing | White lenses and rear spill |
| Braking/blocked feedback | Day/night policy retained | Short bright red pulse | Off once reversing ends |
| Released and settled | Fade off after brief hold (1.6 seconds maximum from activity) | Brake pulse ends, position light fades | Off |
| Select another car | Previous headlights/position lights switch off | Existing brief brake pulse may finish | Off |

The active car uses four fixed SpotLights. Only the two headlights have shadow maps (256×256, cached, maximum 20 Hz updates); rear spill uses short directional falloff without extra maps. While reversing, the dominant rear spill is white at the reversing lenses; dim red position-lens emission can remain at night. This deliberately limits real-time lighting cost.

Brightness tuning after player review: daytime running-lamp emission increased from .12 to .75; reversing spill reduced from 1.8 to .65 per lamp and reversing-lens emission from 1.4 to .65. Brake and nighttime headlight settings are unchanged.

## Verification

`npm test` checks combined-mesh anchor extraction, exact source placement, horizontal/vertical direction, day/night/idle/brake/reverse transitions and the fixed shadow budget, along with all existing engine/model/camera/storage/suspension tests.

`scripts/verify-vehicle-effects.mjs` performs real pointer drags and undo, checks no lane marker while dragging, validates every model's two anchors, tests the nine models through actual selection, compares emitted source coordinates with actual model vertices, checks full-resolution glass, fade-out, and captures desktop/90°/mobile-emulated views. Screenshots and continuous-drag GPU profiles are in this folder. Mobile checks are emulation, not physical-phone testing. The integrated-GPU test environment remains below the smooth-play target; this change does not claim to fix overall rendering performance.

Production build replays all 40 official solution routes and generates the PWA snapshot. `offline.json` records legacy-cache recovery, the correct model hash, preserved progress and offline loading for this build.
