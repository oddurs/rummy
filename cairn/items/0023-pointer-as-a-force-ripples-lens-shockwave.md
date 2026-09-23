---
id: 23
title: 'Pointer as a force: ripples, lens, shockwave'
type: feature
status: idea
milestone: v0.3
depends_on:
- 20
created: 2026-09-22
updated: 2026-09-22
priority: p2
pillar: motion
area: engine
effort: m
---

## Problem

`uMouse` is a smoothed position. Scenes can turn toward it, which is nice but
passive. The pointer could be a physical thing in the grid.

## Proposal

Engine-level effects that work on *any* scene, applied between the scene and
glyph passes as a displacement of where regions sample:

- **ripple**: rings spreading from the pointer's path
- **lens**: a magnifier; cells inside it sample the scene at 2× detail
- **shockwave** on click: one expanding ring that pushes glyphs outward

Plus `uPointer` history (last N positions with timestamps) for scenes that want
their own reaction.

## Cost

A texture lookup offset in the glyph pass. Lens adds samples only inside it.

## Acceptance criteria

- [ ] Three effects, each opt-in
- [ ] Touch works (tap = click)
- [ ] Off under reduced motion
