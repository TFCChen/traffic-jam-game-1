# Reference animal celebration verification

The cast now follows the user's first reference animal sheet: gray bunny, brown
goat, tan cow, yellow chick, white sheep, pink mouse, pink pig and brown dog.
The second reference informs the peeking composition. Paws clap at chest level;
faces remain legible and lower bodies extend beyond the viewport edges.

Validation:
- `npm test`: all 17 suites passed.
- `npm run build`: passed, including 40 official route solutions/replays.
- Played official level 1 through 9 moves to the result panel.
- Checked desktop 1280 × 720, portrait 390 × 844 and small 320 × 568 layouts.
- Confirmed the next-level button responds and closes the result panel.
- No browser console errors were captured in the isolated test tab.
- Responsive checks use a desktop browser viewport, not a physical handset.

Production artwork and prompt record: [reference-mascots](../../art/reference-mascots/README.md).
Screenshots: [desktop](./desktop.jpg), [portrait](./mobile.jpg), [small portrait](./small-mobile.jpg).
