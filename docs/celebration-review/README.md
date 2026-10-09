# Celebration and departure skip — 2026-10-09

- During departure, an invisible full-screen button accepts a click/tap and immediately opens the result. It adds no visible prompt. It is removed when the result is ready; it cannot intercept later menu or retry actions.
- The renderer advances the departure to its completed pose, restoring the camera and hiding the departed car. The result is presented only once, even if the renderer subsequently reports completion.
- Four corner groups each contain a bear, bunny and cat with animated clapping paws. SVG viewBox, preserved aspect ratio and width-only scaling prevent distortion. Decorations ignore pointer events and accessibility focus. Reduced motion uses a static happy pose.
- Portrait layouts reserve top and bottom space; short viewports keep the result scrollable. Collection toasts are hidden while their contents are already in the result panel.

## Verification

- All 17 test suites passed; build solved and replayed all 40 official levels.
- Manually solved level 1 in nine moves on an isolated loopback origin, clicked the departure skip surface before completion, and confirmed the result opened immediately.
- Closed the result and confirmed the skip surface was gone and the game controls were usable.
- Inspected desktop 1280×720, portrait 390×844 and landscape 844×390 layouts. These are browser viewport checks, not physical phone testing.
- Screenshots: desktop.jpg, mobile.jpg, landscape.jpg.
