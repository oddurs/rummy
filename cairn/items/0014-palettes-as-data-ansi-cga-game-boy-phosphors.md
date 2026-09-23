---
id: 14
title: 'Palettes as data: ANSI, CGA, Game Boy, phosphors'
type: look
status: shipped
milestone: v0.2
depends_on:
- 7
created: 2026-09-22
updated: 2026-09-23
priority: p2
pillar: look
area: engine
effort: s
---

## Now

Colour is either one `fg` or free-floating scene colour. Scene colour at full
precision looks like a colour photo in text, which loses the period feel.
Every palette in the demo is a hand-picked fg/bg pair living in demo code.

## Target

`palette: palettes.cga` (or any array of colours) quantizes cell colour to the
palette, with an ordered dither *across cells* so gradients stay smooth. The
demo's looks become library exports.

## Approach

- Palette as a small 1D texture; nearest colour in a perceptual space (OKLab),
  computed in the glyph pass so it runs per cell, not per pixel.
- Bayer or blue-noise dither indexed by cell coordinate.
- Ship: `ansi16`, `cga`, `ega`, `gameboy`, `c64`, `phosphorGreen`,
  `phosphorAmber`, `paper`.

## How we judge it

Every palette on `terrain` and `globe` with scene colour on. Gradients (sky)
must not band.

## Acceptance criteria

- [x] Before/after screenshots attached to the PR
- [x] Palettes exported and documented
- [x] Dithered gradients show no visible banding at 12px

## Built in 0.2

`palette` (any CSS colours, up to 32) and `dither`. Quantization is per cell in the
glyph pass: nearest entry in OKLab (palette converted on the CPU with the same
formulas) after a 4×4 Bayer offset indexed by cell. Shipped as the `palettes` export:
`ansi16`, `cga`, `ega`, `gameboy`, `c64`, `phosphorGreen`, `phosphorAmber`, `paper`.
The demo has a quantize menu and a `cga` look.

**Fixed along the way:** glyph colour was quantized after the 0.1 "lift dark cells"
normalization. Dim cells snapped to the palette's black and vanished (whole arcs of the
ring were missing in `ring-cga`). With a palette, glyph colour now goes to full
brightness before quantizing, because the glyph already carries the tone.

Not verified: banding on a smooth gradient at 12px (criterion 3). The sheet has
terrain's sky in CGA at 10px, but nobody has looked specifically for banding.

## Closed out in PR #4

The test for criterion 3 found real banding. `gradient-ega-no-dither` splits a
smooth ramp into four hard bands, and `dither: 0.6` barely softened them. The
dither amplitude was a fixed ±0.075, while EGA's colours sit about 0.33 apart, so
ordered dithering couldn't reach across a step.

The amplitude now follows the palette: the mean distance from each colour to its
nearest neighbour. `dither` defaults to 1 (full ordered dither). With it, every
hard band edge in the gradient becomes an interleaved transition. What remains
visible is the Bayer pattern itself, at cell size, which is the look
rather than banding.

Before/after: `gradient-scene` (reference), `gradient-ega-no-dither`,
`gradient-ega-dither`, plus the `cga` look throughout.
