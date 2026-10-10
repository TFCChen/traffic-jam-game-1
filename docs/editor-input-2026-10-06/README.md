Editor input polish: the first red car can only start on the exit row; its direction/length controls display horizontal/two cells until placed. Clicking the starting cell again cancels. Invalid length, direction or overlap clears the pending start while keeping the reason visible. Occupied-cell clicks during pending placement are routed to validation instead of beginning an existing-car drag. Invalid drag placement clears a pending selection too.

The utility menu closes on outside pointerdown (mouse or touch) and Escape; Escape restores summary focus. Outside events continue to reach the intended control.

`scripts/verify-editor-input.mjs` uses actual CDP mouse clicks on projected board cells, checking lane restriction, repeated-cell cancellation, diagonal/length/occupied failures, successful subsequent placement and outside/Escape menu dismissal. It restores its isolated browser's stored progress and draft afterward.
