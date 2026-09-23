---
id: 12
title: 'Two-tone cells: a background colour per cell'
type: look
status: shipped
milestone: v0.2
depends_on:
- 7
created: 2026-09-22
updated: 2026-09-23
priority: p1
pillar: look
area: engine
effort: m
budget: <= +0.1 ms GPU at 1080p
---

## Now

Every cell is one glyph in one colour over a global background. Real terminal
art has a foreground *and* a background per cell, which is why ANSI art and
half-block renderers (`▀` with two colours) look so much richer: each cell
carries two tones, doubling the vertical resolution with block glyphs.

## Target

An option, `cellBackground`, where each cell also gets a background fill from
the scene: the darker tone in the cell goes to the background and the glyph
draws the lighter one. With `charsets.blocks`, this should approach a
low-resolution image while still reading as text.

## Approach

- In the glyph pass, split the six samples into two clusters (ink, paper) and
  output both colours. RGBA8 is full, so this needs a second render target
  (MRT) or packing colour at lower precision.
- Shape matching runs on the normalized contrast between the two clusters, not
  on absolute tone, which is the classic two-colour quantization.
- Composite: `mix(bgCell, fgCell, ink)`.

## How we judge it

`blocks` and `ascii` charsets, scene colour on, on `terrain` (sky gradient) and
a dropped photo.

## Acceptance criteria

- [x] Before/after screenshots attached to the PR
- [x] Frame cost within `budget`
- [x] With `blocks`, a photo is recognisable at 12px
- [x] Off by default; existing output unchanged when off

## Built in 0.2

`cellBackground: 0..1`. Samples darker than the cell mean average into a paper colour.
The cell background moves toward it by that amount, and tone is re-measured above the
background, so the glyph draws only what rises above it. The glyph pass now writes two
targets (glyph + fg, bg + alpha). Colour for both is resolved per cell.

Evidence: `terrain-blocks-two-tone` (blocks charset, scene colour, `cellBackground: 1`)
reads as a clean pixel-art sunset. With `cellBackground: 0` the code path is skipped
entirely and the background is the global `bg`. Bench: 1 vs 0 within noise.

**Not verified:** a real photo at 12px (criterion 3). Only the synthetic dark source and
the scenes were tested; drop a photo on the demo with the `blocks` charset.

## Closed out in PR #4

Real photo: NASA's AS11-40-5903 (public domain, now demo/public/fixtures/aldrin.jpg) at 12px with the blocks charset and cellBackground 1 (`photo-blocks-two-tone`). The astronaut's legs and boots, his long shadow and the craters are all plainly readable. Before/after pair: `terrain-scene` vs `terrain-two-tone`.
