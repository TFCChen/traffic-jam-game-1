# Peek-in celebration cast — 2026-10-09

- Replaced the repeated three-animal groups with eight unique characters: rabbit, owl, fox, panda, otter, hedgehog, cat and dog.
- Each has its own head silhouette, facial expression and markings. Accessories, paw/wing shapes, clap timing and arrival timing vary.
- Desktop corners each have two different characters. Bodies extend beyond the viewport and heads point inward, with a brief entrance from the edge.
- Portrait phones redistribute four characters along the side edges, forming an eight-character surround. Side characters raise their paws to keep the clap visible while peeking.
- SVG aspect ratios are preserved; decorations ignore pointer input. Reduced motion keeps a static celebration pose.

## Verification

- All 17 game test suites passed; production build replayed all 40 official routes.
- Inspected desktop 1280×720 and portrait 390×844, plus the 320×568 narrow viewport. Checked the short-screen panel's scroll access to result buttons.
- Existing completed test session on isolated loopback origin preserved; no changes to the user's progress.
- Screenshots in this folder show the desktop and portrait arrangements. These are browser viewport checks, not physical-device testing.
