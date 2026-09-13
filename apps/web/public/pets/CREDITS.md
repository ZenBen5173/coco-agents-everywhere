# Pet sprites

## phoenix.png — Phoenixling

- **Artist:** Elthen (Ahmet Avci) — [Elthen's Pixel Art Shop](https://elthen.itch.io/2d-pixel-art-phoenixling-sprites)
- **Licence:** free ("name your own price"). Commercial use permitted;
  redistributing or reselling the assets is not, and neither is blockchain use.
  **Not** public domain — so this file must not be republished as an asset,
  which is one more reason this repo stays private.
- **Attribution:** not required, but the artist asks nicely, so it is recorded
  here and shown on the Progress page.

### How this file was made

The frames were recovered from the **public preview animation** on the store
page, because itch.io's name-your-price download needs a browser session. The
preview renders at 5x, so it was reduced to native resolution, the birds were
separated from the checkerboard, and the unique frames were kept.

That means this is a faithful copy of what the preview shows, but **not** the
full product. The real download has six animations at clean 64x64 — Idle,
Movement, Attack, Damage, Death and Rebirth. Grabbing it is one free click on
the page above, and dropping it in here would be a straight improvement.

### Layout

640x112, a grid of 40x56 cells. Frames sit on the cell floor so the bird does
not hop between frames of different heights.

| Row | Animation | Frames |
|-----|-----------|--------|
| 0   | `idle`    | 4      |
| 1   | `rebirth` | 16     |

`rebirth` runs death and return as one sequence: the bird collapses into flame,
burns down to ash, an egg forms and cracks, and it bursts back out.


## dragon.png — Dragon

- **Artist:** Cethiel — [Dragon – Fully Animated](https://opengameart.org/content/dragon-fully-animated)
- **Licence:** CC0 (public domain). No attribution required, no restriction on
  use or redistribution. Credited anyway because the work deserves it.

### How this file was made

The source is **not** pixel art. Cethiel drew it and animated it with bones in
DragonBones, and it ships as 1,197 PNG frames at 725x445 across seven
animations — 139 MB, and far too smooth to sit beside the Phoenixling.

So it was converted, and the conversion is the interesting part:

- **Walking, not Idle.** Measured at pet size, Walking moves 7.9/255 against
  3.0 for either idle animation. The idles were built for a canvas fifteen
  times larger, where a head-dip and a slow breath read; shrunk to 48px they
  are a statue.
- **One crop box across every animation.** The first attempt measured the
  bounding box on Idle alone and reused it, which cut 58px off the head the
  moment the dragon stepped forward. The box is now the union of all frames of
  all animations, which also keeps the sprites aligned with each other.
- **Colour opened up before shrinking.** The source averages RGB(56,45,39) —
  near-black brown. Quantising that directly gives twenty shades of mud, so
  saturation, contrast and brightness are raised while the full-size pixels are
  still there to be separated.
- **Alpha thresholded hard.** Painted art is anti-aliased everywhere, and a
  soft edge is what makes a shrunken picture look shrunken rather than drawn.
- **One palette for the whole animation.** Quantising each frame separately
  makes the colours crawl between frames.

16 frames, one row, 83x48 cells, 24 colours.

Honest limitation: it is still a reduced painting rather than hand-placed
pixels, and next to the Phoenixling that shows.

---

## ../coin.png — the spinning coin

- **Artist:** truezipp — [Pixel Coins Asset](https://opengameart.org/content/pixel-coins-asset)
- **Licence:** CC0 (public domain). No attribution required; credited anyway.

54x10, six frames of 9x10, six colours. Played the same way the pets are, and
scaled only by whole numbers.

It replaced a coin drawn in CSS — a gold gradient on a card rotating in 3D.
That version span, and still read as the emoji it was meant to replace, because
a radial gradient at 15px is a shiny dot however you turn it. Six hand-drawn
frames have something the gradient never could: an edge, one pixel wide, as the
coin passes side-on.
