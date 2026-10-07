# Courtyard daylight, dusk and material definition

Version `c28ff764`, following `d5e24745`.

- Daylight separates a warm key from a cooler sky fill. Dusk now lowers the existing sun from height 10 to 4.6 and increases horizontal reach to 9.5, producing longer silhouettes and warm highlights against cooler shaded surfaces. Existing light direction/intensity controls still apply. Rain and night lighting presets are unchanged.
- A deterministic eight-family scenery atlas replaces the generic four-family texture: oak pores/grain, limestone, foliage, powdercoat/brass, brick pits, woven canvas, soil and ceramic. All use mipmap filtering. Atlas size increases from 512 square to 1024 by 512; a small bump response accompanies existing per-vertex material roughness/metalness. No extra geometry, draws, lights or reflection captures.
- The established paving geometry, ground wetness, fence shadow filter and camera controls are retained.

## Validation

All 16 suites passed and build replayed all 40 official routes. Material tests check family assignment, seeded stability and opacity. The browser fixture uses valid completed-level records and asserts the requested theme is actually rendered (an initial incomplete fixture fell back to daylight; those comparisons were replaced).

`before/` uses the previous theme and scenery material implementation. `after/` compares identical normal, overhead, cafe and bench cameras, plus rain/night and mobile/saver views. Images were inspected for highlight clipping, dark-side readability and detail scale. Existing single-sun shadows grow longer at dusk; this does not add a physically simulated sky or ray tracing.

| Profile | Before GPU median / p95 | After GPU median / p95 | Draws before / after |
| --- | --- | --- | --- |
| Day idle | 15.29 / 17.96 ms | 16.78 / 21.10 ms | 100 / 100 |
| Dusk idle | 16.72 / 18.13 ms | 17.54 / 18.36 ms | 101 / 101 |
| Mobile dusk viewport | 14.49 / 18.20 ms | 14.65 / 18.34 ms | 101 / 101 |
| Day orbit | 13.10 / 13.58 ms | 13.17 / 13.69 ms | 100 / 100 |
| Dusk orbit | 14.33 / 14.94 ms | 14.42 / 15.06 ms | 101 / 101 |

These are separate desktop Chrome runs, not controlled hardware comparisons. Added texture/bump sampling is not free; idle timings varied more than orbit. Mobile uses desktop device/touch emulation, not a physical phone. Saver's static scene produced no ongoing profile samples; it draws 98 batches in both versions.

`gameplay/` covers native mouse/touch dragging in actual dusk, exit, low camera angles, replay, trial return and official next level. `camera/` checks repeated off-center orbit with simultaneous pitch changes, release frames and stable scale. Test browser storage is restored.
