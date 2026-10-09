# Plush cheering cast

Historical production record. This cast was replaced by the user's illustrated
animal reference set; current assets and prompts are documented in
[reference-mascots](../reference-mascots/README.md). The old runtime assets remain
recoverable from Git commit `b6d94b1` rather than occupying the PWA offline cache.

Eight original transparent mascots generated with the built-in `image_gen` tool:
rabbit, owl, fox, panda, otter, hedgehog, cat and dog. Each has a distinct
expression, rounded proportions, soft fur and detached paws for clapping.

The final prompt set is recorded in [prompts.json](./prompts.json).
Former full-resolution WebP assets were saved in `public/mascots`; their metadata
was `src/plushMascots.json` at that commit.

`scripts/prepare-plush-mascots.py` accepts a JSON mapping of species to generated
RGBA PNG paths. It encodes the original resolution as WebP with alpha, detects
the three separate alpha islands, and writes SVG clipping metadata. It does not
paint or reshape the artwork. All eight production assets total about 2.5 MiB.
The PWA precaches them for offline celebrations.

The game uses proportional SVG view boxes and CSS paw/bob animation. Desktop
corners contain two characters each; portrait phones place the companions along
the side edges. The decoration does not intercept controls and respects reduced
motion.
