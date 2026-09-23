---
id: 51
title: Screen-reader text mode for small grids
type: feature
status: dropped
milestone: later
created: 2026-09-22
updated: 2026-09-23
priority: p3
pillar: reach
area: api
effort: m
---

## Problem

For small, meaningful ASCII (an animated logo in a footer, a diagram) there
is a case for real text: selectable, copyable, zoomable.

## Proposal

`output: 'dom'` renders the glyph target into a `<pre>` via the `toText`
readback, at a low frame rate, for grids under a few thousand cells. Not for
full-screen heroes; that is what the canvas is for.

## Acceptance criteria

- [ ] Selectable, copyable output identical to the canvas
- [ ] Refuses (or warns) above a cell-count limit

## Measured: not worth it

Prototyped against the 0.3 bundle: renaming the 101 internal GLSL identifiers (locals, helpers, function names; uniforms and the prelude API untouched) to two-character names saved **0.17 KB** of 16.3 KB gzipped. gzip already deduplicates repeated identifiers, so short names buy almost nothing, and the renaming would need a real GLSL tokenizer to be safe across interpolated shader fragments. Dropped. The size gate remains the control: increases are recorded decisions in 0009.
