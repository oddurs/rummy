---
id: 13
title: 'Glow that costs nothing: bloom at cell resolution'
type: look
status: review
milestone: v0.2
depends_on:
- 7
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: look
area: engine
effort: s
budget: <= 0.15 ms GPU at 1080p
---

## Now

Glyphs are hard-edged ink on a flat background. Phosphor screens glow: bright
characters bleed light into the cells around them. That halo is most of what
makes a CRT screenshot feel warm, and every "retro terminal" effect fakes it
with a full-resolution blur that costs more than rummy's whole frame.

## Target

A soft halo around bright text, tinted by the glyph colour, strongest where
text is dense.

## Approach

The cell grid is already a tiny image of the frame's brightness. Blur *that*
(two separable passes at cell resolution: ~15k texels instead of millions),
then in the composite pass sample it bilinearly and add it under the glyphs.
The blur is resolution-independent in cost terms, so this is the one bloom that
really is almost free.

Options: `glow` (strength), `glowRadius` (in cells).

## How we judge it

All palettes, dark backgrounds especially. Must not muddy `paper`.

## Acceptance criteria

- [ ] Before/after screenshots attached to the PR
- [x] Frame cost within `budget`
- [x] No full-resolution intermediate buffer

## Built in 0.2

`glow` and `glowRadius` (in cells). Light per cell = glyph colour × the glyph's mean
ink coverage (already in the shape vectors). A separable Gaussian runs over the cell grid
in two RGBA8 passes. The composite samples it bilinearly and mixes toward the glow
colour, so a dark-on-light palette gets an ink bleed instead of a white halo. All five
dark demo looks use it.

Cost, M4 1080p: the glow column reads 0.03 to 0.23 ms, which is inside the timer's
noise, and totals with glow 0.35 vs 0 are indistinguishable. The budget holds as far
as this timer can resolve.
