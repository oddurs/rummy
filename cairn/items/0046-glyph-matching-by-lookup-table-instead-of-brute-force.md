---
id: 46
title: Glyph matching by lookup table instead of brute force
type: perf
status: idea
milestone: later
depends_on:
- 8
created: 2026-09-22
updated: 2026-09-22
priority: p3
pillar: speed
area: engine
effort: m
---

## Where the time goes

The glyph pass compares every cell with every glyph: ~190 texel fetches per
cell with 95 glyphs. Measured in 0.2 on an M4 at 1080p, the whole glyph pass
(matching, contrast, silhouettes, colour) is ~0.3 ms, so this is not urgent.
It is the only part of the pipeline that scales with charset size.

## Proposal

Only if the bench shows the glyph pass above ~20% of the frame on target
hardware: precompute the nearest glyph for a quantized 6D grid (e.g. 6 levels
per axis, 46,656 entries, a 216×216 texture) when the atlas builds, and replace
the search with one lookup. Quantization error needs checking against the
screenshot harness.

## Before → after

| | before | after |
|---|---|---|
| glyph pass, 95 glyphs, 1080p, M4 | ~0.3 ms | to measure |

## Acceptance criteria

- [ ] Only built if measurement justifies it
- [ ] No visible difference on the contact sheet
