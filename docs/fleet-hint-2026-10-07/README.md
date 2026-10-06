# Compact fleet controls and actionable hints

The editor keeps a compact selection button showing the selected model and total vehicle count. The full fleet is a bounded, scrollable two-column popup; it closes after selection, on an outside press or Escape. Only the selected car's replacement/removal actions remain visible. Its size no longer grows with the number of placed cars. Replacement and fleet popups share a centered position that fits narrow viewports.

The 3D hint includes a dark-backed gold route, one waypoint per moved cell, a visible arrow tip, the full final vehicle footprint and a numeric distance label. The label faces the camera and stays approximately 112 screen pixels wide through zoom and viewport changes. It sits along the route so it does not obscure the arrow tip. The guide is visual-only and does not take pointer input. Committing a move clears it through the existing hint lifecycle. The 2.5D fallback also gains a destination frame and explicit distance.

Hint meshes and texture are allocated once per scene. Label drawing updates only when the hinted move changes, and all guide resources are released on scene disposal. The guide remains hidden during editing and victory.

## Verification

- `npm test` passes, and production build replays all 40 official routes.
- `scripts/verify-fleet-hint.mjs` checks an eight-vehicle editor fixture, default collapse, selection/collapse and bounded menus at 390px and 320px widths.
- A solvable fixture requires moving a vertical three-cell bus exactly three cells. Its destination frame is asserted against the resulting grid position, then a native mouse drag moves the actual bus to that location. The guide clears afterward. The next hint is a horizontal four-cell move.
- Desktop/mobile screenshots were inspected for the compact toolbar, hint arrow, label and destination footprint. Mobile checks are Chromium viewport emulation, not physical device tests. Runtime exceptions: none.
