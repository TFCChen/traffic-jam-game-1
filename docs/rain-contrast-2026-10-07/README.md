# More visible rain-after surfaces

Version `82c632c5`. Follow-up to the visually understated first rain-after pass.

- The whole wet surface has a stronger baseline wetness, with variable damp patches layered over it. Asphalt darkens more than pale paving and painted markings.
- Enlarged the seven margin puddles while keeping the central puzzle area free of large pools. Smooth blue-grey water tint, flatter normals, stronger sky/environment reflections and clearer cloud contrast make low spots visible from overhead and ordinary gameplay angles.
- Increased water-film coverage without interpolating its roughness at the puddle boundary, preserving the fix for artificial bright outlines. A cooler, softer sun and ambient palette distinguish rain-after from warm daytime lighting.
- No additional geometry, render passes, textures, lights or draw calls over the preceding rain-after version. Reflections remain sky/local-light highlights rather than whole-scene mirrors.

All 15 test suites passed; production build replayed 40 official solutions. Eleven browser views passed, including overhead, reflected-light angles, mobile and saver quality. Native theme selection worked with zero completed levels; no browser exceptions. Screenshots were visually inspected for wetness visibility, vehicle readability and bright contour artifacts.

Headless Chrome profile medians: dry CPU/GPU 1.50/14.81 ms (100 draws), wet 1.50/16.88 ms (101 draws), mobile viewport 1.60/16.89 ms (101 draws). Idle 30 FPS, zero idle shadow updates. Mobile is desktop emulation, not a physical device measurement; these short samples are not a guarantee of sustained device frame rates. Ground-only visual changes do not modify input or gameplay logic; the preceding revision's native gameplay verification is under `../ground-2026-10-07/gameplay/`.
