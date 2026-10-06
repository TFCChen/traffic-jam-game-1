# Editor workflow and integrated racer lamps

The editor opens with an empty draft. Two endpoints determine horizontal/vertical placement and a two/three-cell length, in either drawing direction. The red target remains a horizontal two-cell vehicle in the exit row. Placement previews now describe the endpoints rather than a preset vehicle tool. Invalid endpoints and repeated origins cancel selection; Escape also clears the origin.

Editing tools occupy one floating dock, with a compact placed-vehicle list above it. Selecting a non-target vehicle offers replacement by another model of the same length, preserving its ID, direction and position. The target only offers removal. The old model/orientation tray and redundant editor/level buttons are removed. A temporary aligned editor view leaves the game's saved view intact. Trial play retains the draft, and leaving the editor restores the previous actual game state.

The racer has one recessed assembly on each side. Each assembly groups the projectors and running-light signature under a curved transparent cover. Its black cavity and reflector barrels provide physical depth. The previous separate strip and flat circular lenses are removed. The cover uses a transparent reflective physical material without adding another screen transmission pass.

## Verification

- `npm test`: game logic, model geometry/materials, lamp timing/anchors, suspension, particles, persistence, camera, shadows, and new bidirectional drawing cases pass.
- `npm run build`: all 40 official solution routes replay successfully; production/offline build succeeds.
- `node scripts/verify-editor-repair.mjs <CDP browser WebSocket>`: native mouse and emulated mobile touch exercise placement, replacement, undo/redo, saving and trial return. Hit testing checks every cell in a 1440×1000 desktop and 390×844 mobile viewport, plus the relevant action buttons. The script backs up and restores test-profile storage.
- Native mouse dragging moves the racer, rotates its wheels and advances the actual headlamp origins by the same displacement; undo restores the move.
- The screenshots in this directory were inspected for complete controls and the integrated front lamps. Mobile input is browser emulation, not a physical iPhone test.

The earlier verification did not sufficiently assess the cost of replacing free endpoint drawing with a preset tool. Native hit tests additionally exposed inherited CSS clipping the desktop vehicle list; its fixed height has been removed. Trial return is now a visible toolbar action rather than an item hidden inside the utility menu.

The vehicle replacement popup intentionally overlays the scene while open and closes on an outside press or Escape. Future editor improvements can focus on sharing an individual authored level and a compact view of its verified solution, without adding permanent panels to the scene.
