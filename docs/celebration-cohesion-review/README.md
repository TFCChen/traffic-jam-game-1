# Celebration layout refinement — 2026-10-10

Game version: `51a4f701`.

- Kept all eight reference animals and the half-body peeking composition.
- Reduced corner animal base width from 148 to 132 px; applied additional 0.9 rabbit and 0.85 chick optical scales to their complete SVGs, including paws.
- Desktop animals now frame a centered 760 × 640 px maximum celebration area instead of distant viewport corners. Portrait layouts retain viewport corners and side guests with space for controls.
- Removed the separate gold emblem and redundant success sentence. Kept the finale explanation, rewards, score, stars, retry/next controls and accessible focus handling.
- Softer charcoal card, warm light, rounded controls, quieter movement and muted confetti. Animals arrive after the card; reduced-motion behavior remains available.

Validation:

- All 17 test suites passed.
- Production build passed, including all 40 official solution replays. The first sandboxed build hit an esbuild spawn EPERM; the approved build succeeded.
- Tested through the in-app browser at isolated origin `http://127.0.0.6:4173/`, preserving the user's localhost storage.
- Activated the new PWA through the existing update button without clearing storage.
- Played level 01 through nine drag moves twice. Retry completed initialization at level 01 with zero moves; next completed initialization at level 02 with zero moves.
- Inspected desktop 1280 × 720, portrait 390 × 844, small portrait 320 × 568, and landscape 844 × 390. Small portrait has no page horizontal overflow and both action centers are unobscured; the result card scrolls. Landscape actions are accessible by scrolling.
- No browser console errors captured. Viewport checks are desktop browser simulation, not physical-device GPU tests.

Screenshots: [desktop](desktop.png), [portrait](mobile.png), [small portrait](small-mobile.png), [landscape](landscape.png).

Editor trial completion/return was not retested in this change.
