---
id: 10
title: Integrate each region instead of point-sampling it
type: look
status: review
milestone: v0.2
depends_on:
- 7
- 8
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: look
area: engine
effort: m
budget: <= +0.3 ms GPU at 1080p
---

## Now

Each of a cell's six regions is one point sample at the region centre. Thin
features (the tunnel's grid lines, the globe's graticule) alias: a line
narrower than a region either hits a sample or vanishes, so it flickers as it
moves and breaks into dashes when still. `quality: 2` helps by box-filtering
2×2, at 4× the scene cost.

## Target

Thin lines read as continuous strokes of `-`, `|`, `/` at the default quality,
and moving edges stop crawling.

## Approach

Options, to be measured rather than argued:

- **Rotated-grid 4-tap** per region at `quality: 1`, sharing taps between
  neighbouring regions to cut the cost below 4×.
- **Harri's staggered circles**: sample areas that overlap slightly, which his
  write-up found matches glyph shapes better than a strict grid.
- **Temporal jitter**: one sample per region per frame at a jittered position,
  accumulated through the history buffer from the glyph-boil work. Nearly free,
  but only for animated scenes.

## How we judge it

`tunnel` and `globe` at 10px and 16px, still and in motion, against today's
`quality: 1` and `quality: 2`.

## Acceptance criteria

- [x] Before/after screenshots attached to the PR
- [x] Frame cost within `budget`
- [x] Default quality visibly closer to today's `quality: 2` than today's `quality: 1`

## Built in 0.2

Chose **temporal jitter**, one of the three options listed. It has the best cost:
one extra `texelFetch` per sample, against 4× for rotated-grid or `quality: 2`.

- Each frame samples at an R2-sequence offset inside the region and blends into a
  ping-ponged history (`antialias`, default 0.6).
- In motion the blend is exponential. On a still frame it becomes a uniform average over
  16 frames, then the loop idles. Stills converge to heavy supersampling for a one-time
  cost of 16 frames.
- `antialias: 0` reproduces the 0.1 point sampling exactly (no jitter, no history).

Evidence: on the contact sheet, `globe-phosphor` (default) matches
`globe-quality-2` far more closely than `globe-no-antialias` does. The graticule and limb
are continuous in the first two and broken into dashes and stray glyphs in the third.
Bench, M4 1080p: antialias 0.6 vs 0 totals are within run-to-run noise (±0.3 ms).

Not yet judged: how much ghosting the history adds on fast motion. It is short
(about 50 ms at 60 fps with the default) and reads as phosphor persistence, but
someone should look at it moving in a real browser.

## Before/after

Side-by-side is in PR #1's `shots` artifact (the with/without comparison shots).
