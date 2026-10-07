# Fence shadow isolation — 2026-10-07

Build `0607156e`. The user reports that the preceding depth-bias and stable-PCF changes did not improve the flickering on their phone. The cause is therefore still unresolved on that device. This version directly removes fence shadow casting and receiving to isolate that hypothesis, rather than treating another filter adjustment as a confirmed solution.

The fence formerly shared material batches with street furniture and foundations. Its 32 shoes, 32 posts, 32 caps and 10 rails now have dedicated fence materials, combined into one visible `Courtyard fence` mesh. The fence was rebuilt from the generator's original dimensions, bevels and weighted normals; paint/metal responses remain unchanged. The saved Blender courtyard and GLB match the generator. The fence mesh has 4,664 triangles, `castShadow=false` and `receiveShadow=false`. It retains ordinary PBR illumination, but does not project shadows on the ground and does not receive shadows from other objects. Vehicles and other scene objects retain their existing shadow policy.

## Verification

`VERIFY_FENCE_ISOLATION=1` with `scripts/verify-fence-shadows.mjs` asserts the fence is visible, has geometry, and has both shadow flags disabled in the actual rendered instance. [Inspection](inspection.json) confirms this in day/high, day/standard, sunset/high, neon/high and 393×844 / DPR 3 mobile emulation. Native right-drag/middle-drag/wheel and one/two-finger gestures passed; camera movement did not update the shadow maps. Screenshots retain vehicle/street shadows. No runtime/console errors.

`npm test`: all 13 modules passed, including corner overlap checks on the new dedicated fence materials, ground/exit support and original vehicle assets. `npm run build`: 40 official routes replayed, production build and offline cache generated. Scene size is 3,046,388 bytes.

The tradeoff is one additional visible material batch for independent fence control; fence triangles are removed from shadow passes. No shadow resolution increase. This is a diagnostic workaround pending the user's physical-device test. If the flicker persists in this specific build, fence casting/self-shadowing is excluded; the next investigation should isolate perimeter surface overlap/depth precision and visible thin-geometry aliasing.
