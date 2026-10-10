# Rebased screen-center orbit

Version `d5e24745`, following `d7b5ea58`.

The user's recording shows right-button orbit from an off-center view at 65% zoom. The previous regression covered 400% zoom with zero stored focus, missing focus saturation. Added two 65% cases with focus at stored limits: the previous release still displaced the center by 4.9782 and 4.5920 model units.

Rotation now rebases around the current screen-ground pivot instead of accumulating focus corrections. The bounded focus remainder is carried in camera-plane pan coordinates, preserving the pivot despite focus normalization. Camera refresh/release and fixed orthographic size remain unchanged.

All 16 suites and build pass, including replay of 40 official routes. Native right-button browser tests rotate both directions through multiple revolutions and change pitch, covering yaw wrapping and release frames. `after/inspection.json` checks center drift below 0.0001 and unchanged frustum width; screenshots are included. `visible/` adds an off-center 65% view with the actual courtyard visible. `gameplay/` checks mouse/touch moves, exit, replay, trial return and next level. All browser storage is restored. No user recording is copied into the repository.
