# Screen-edge celebration — 2026-10-10

Version: `b0f098f0`.

The user rejected the centered desktop animal frame: animals should peek in from the screen edges and clap. The mismatch to address is the result UI styling, not the animals' perimeter composition.

- Restored a full-viewport celebration area on desktop, with all eight reference animals at the screen corners. Removed the 760 × 640 container and its clipped/faded boundary.
- Kept rabbit/chick optical size corrections and the existing clapping animation.
- Changed only the result card to warm ivory, charcoal text and butter-gold controls; simplified score framing and softened stars and button shapes. The main game UI remains charcoal.
- Kept portrait corner/side positions and small-screen card scrolling, focus handling and reduced motion.

Validation:

- Production build passed, including replay validation of all 40 official solutions. This CSS-only follow-up did not rerun the 17 logic suites that passed in the preceding change.
- Played level 01 through nine actual drag moves at isolated origin `http://127.0.0.6:4173/`.
- Activated the final version through the existing PWA update flow, preserving storage; confirmed the final stylesheet was loaded.
- Inspected 1280 × 720, 390 × 844 and 320 × 568 screenshots. Desktop celebration bounds are exactly the viewport. Both portrait layouts have no horizontal page overflow and unobscured retry/next button centers.
- No browser console errors captured. Portrait checks are desktop viewport simulation, not physical handset testing.

Screenshots: [desktop](desktop.png), [portrait](mobile.png), [small portrait](small-mobile.png).
