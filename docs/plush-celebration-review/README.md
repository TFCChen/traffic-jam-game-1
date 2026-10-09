# Plush celebration verification

- Played official level 1 manually to completion in 9 moves.
- Clicked the departure animation to skip directly to the result panel.
- Confirmed eight distinct textured mascots and articulated paws in the result.
- Visually checked desktop 1280 × 720, portrait 390 × 844 and 320 × 568.
- The smallest viewport keeps the panel scrollable; its replay button works and
  returns the level to 0 moves. Mascots preserve their aspect ratios.
- No browser console errors were captured in the isolated test tab.
- `npm test`: all 17 suites passed.
- `npm run build`: passed, including all 40 official solution route replays and
  offline asset generation.
- This is desktop browser responsive verification, not a physical phone run.

Screenshots: [desktop](./desktop.jpg), [portrait](./mobile.jpg),
[small portrait](./small-mobile.jpg).

Art generation and final asset records: [production notes](../../art/plush-mascots/README.md).
