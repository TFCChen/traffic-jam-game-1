# Coupe wheel arch repair

The coarse, non-planar coachwork faces produced uneven edges when boolean wheel
openings were triangulated during GLB export. The coupe now uses two subdivision
levels and explicit planar triangulation before the cuts. The circular cutters
use 96 segments and extend beyond the outer body surface.

Only `racer.glb` changed among the runtime assets. Its size increased from 948,044
to 1,061,296 bytes; material batching and draw calls are unchanged.

Validation: production build, complete npm test suite, 300% close-ups from both
sides and an oblique overhead view, low-angle picking, a one-cell mouse drag,
settled suspension, and undo. Windows CDP mouse moves explicitly retain the left
button to avoid cancelling pointer capture in the background test browser.

App version: `4f6d9a65`.
