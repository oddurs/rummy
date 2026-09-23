---
id: 51
title: Screen-reader text mode for small grids
type: feature
status: idea
milestone: later
created: 2026-09-22
updated: 2026-09-22
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
