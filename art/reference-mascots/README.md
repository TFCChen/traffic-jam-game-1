# Reference animal celebration cast

Built-in `image_gen` tool used with the user's first attached animal sheet as
the visual reference. The final cast follows that sheet's species, colors,
simple facial features, round cheeks and painted texture: brown goat, tan cow,
yellow chick, white sheep, pink pig, pink mouse, gray rabbit and brown dog.
The previous fox, owl, panda, otter, hedgehog and cat cast is no longer used.

The second attachment provides the composition reference: inward-facing corner
guests, side companions on portrait phones, and lower bodies cropped by the
screen edge. Paws animate independently, with distinct timing for each guest.

Final prompt set: [prompts.json](./prompts.json).
Final runtime artwork: `public/reference-mascots/*.webp`.
Exact filenames, image dimensions and clipping regions:
[src/referenceMascots.json](../../src/referenceMascots.json).

Rebuild metadata with `scripts/prepare-plush-mascots.py INPUTS.json
reference-mascots referenceMascots.json`, where INPUTS maps each species to its
generated RGBA PNG. This performs WebP format encoding and alpha-island analysis;
it does not repaint or reshape the generated artwork. The three islands are
drawn with proportional SVG view boxes and animated using CSS.
