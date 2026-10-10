# Recessed passenger cells and credible cabin spacing

The previous interior placed carpet almost at cushion height while leaving solid exterior coachwork underneath. More props could not fix this structural problem. Passenger cars and the motorhome now have a carved interior tub; the truck cab and bus passenger shell also have real recessed cavities. Carpet and individual foot mats sit 0.12–0.15 model units below the front cushions. Narrow seat runners and separate mounting pedestals support each seat, leaving space around the bases. Footwells include sloped toe boards and driver pedals, with a narrow central transmission tunnel.

Door cards, handles and armrests are lower, so they no longer read as a thick plank obstructing the coupe's side window. The dashboard gains a layered passenger insert, glovebox, smaller satin fascia, stitched brow and falling centre stack. Existing gauges, vents and steering-wheel details remain. Bus passenger seats now have pedestals and a continuous carpeted aisle rather than sitting inside a solid body shell.

## Reference review

- Ferrari-authored [296 GTB Product Information](https://iacpfa.org/wp-content/uploads/2023/01/Ferrari-296-GTB_Product-Information.pdf), especially pages 90–100. Pages 92 and 96 were rendered locally and visually inspected: the carpet/tunnel transition and compact driver-side instrument architecture informed the simplified layout. [Ferrari's interior-design article](https://www.ferrari.com/en-CA/magazine/articles/the-inside-story-interior-design) also discusses separation of driver and passenger spaces.
- Turn 10's [GDC 2012 production presentation](https://media.gdcvault.com/gdc2012/slides/Production%20Track/Shek_Arthur_Racing_to_the.pdf), pages 11–14: reference specifications, polygon budgets, priority detail areas and staged QA. This is general Forza production guidance, not a disclosed Horizon 6 interior implementation.
- [Forza Horizon 6's official garage/Forzavista overview](https://forza.net/news/forza-horizon-6-sandbox) establishes the close-inspection use case. It does not disclose the underlying cockpit asset workflow.
- Rockstar's [GTAV first-person camera documentation](https://support.rockstargames.com/articles/4SLMPiZCrVUVcuL71dBD29/changing-camera-perspective-to-1st-person-in-gtav) and [interior-customisation update notes](https://support.rockstargames.com/articles/41mykE7EnAzNZSOYiJFnB4/gtav-title-update-1-31-notes-ps4-xbox-one-pc) document cockpit inspection functionality, not mesh construction. No proprietary GTA/Forza assets were extracted or used.

The implementation is an original, simplified interpretation of credible car packaging for an exterior-view puzzle game. It does not claim the fidelity or internal rendering techniques of those larger games.

## Verification

- Model regression rays check all nine front footwells for a visible carpet/mat surface below cushion height, avoiding opaque exterior coachwork. Existing lane bounds, bonnet continuity, glazing, mirrors, upholstery colours and seat visibility remain checked.
- `npm test` and `npm run build`, including the 40 official solution replays.
- `scripts/verify-cabin-space.mjs` preserves isolated-browser storage, captures daylight/sunset/neon front/rear/side close-ups and mobile layout, then verifies actual orbit, zoom stability, legal pointer drag, undo and live quality switching. `verification.json` contains local CPU/GPU measurements; these are not real-phone measurements or guarantees.

Editable source: `art/toy-garage.blend`; generator: `scripts/build_models.py`.
