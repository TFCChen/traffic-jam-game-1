# Wheel, tyre and brake detail

All nine vehicle assets now use rounded tyre sections with longitudinal grooves,
diagonal tread sipes, recessed rim barrels, shaped spokes, centre caps and lug
details. The coupe has split five-spoke alloys and drilled-disc details; passenger
cars have six/eight-spoke alloys; utility vehicles use smaller six-spoke rims and
thicker sidewalls; commercial vehicles use pressed hubs with ventilation details.

Passenger-car brake calipers are separate authored parts but merge into the same
runtime wheel batch. A `wheelSpin` attribute fixes their position and normals while
tyres, discs and rims rotate. Brushed steel, polished alloy, enamel and rubber retain
their own surface response. There are no additional wheel draw calls or textures.

Validation: full npm test suite and production build; 300% side and oblique coupe
close-ups; utility, compact and coach screenshots; mouse and emulated touch
one-cell drag, actual wheel rotation and undo; browser console without errors.
Every vehicle's wheel batch remains below 16,000 triangles.

Same-device profiling at high quality, official level 1 (40+ frames):

| Metric | Before | After |
| --- | ---: | ---: |
| Draw calls | 90 | 90 |
| GPU geometries / textures | 76 / 14 | 76 / 14 |
| Scene triangles | 235,678 | 269,598 |
| Desktop CPU median | 0.9 ms | 1.0 ms |
| Desktop GPU median | 19.80 ms | 20.02 ms |
| Mobile viewport CPU median | 0.9 ms | 0.9 ms |
| Mobile viewport GPU median | 11.20 ms | 9.25 ms |

The mobile viewport uses the desktop computer's GPU, not a physical phone.
These short runs establish the draw-call budget and approximate local render
cost; timing variation does not establish an improvement on mobile hardware.
Detailed samples are in the before/after verification JSON files.

App version: `a6f053f2`.
