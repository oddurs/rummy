---
id: 23
title: 'Pointer as a force: ripples, lens, shockwave'
type: feature
status: review
milestone: v0.3
assignee: Oddur Sigurdsson
claimed: 2026-09-23
depends_on:
- 20
created: 2026-09-22
updated: 2026-09-23
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

- [x] Three effects, each opt-in
- [x] Touch works (tap = click)
- [x] Off under reduced motion

## Built

`pointer: true | { ripple, lens, lensRadius, shockwave }`. The effects bend where the
glyph pass samples the scene, so they work on any scene, built-in or custom:
- **ripple:** waves spread from the last 8 pointer positions and fade over ~2.5 s.
- **lens:** a 2× magnifier with a soft rim.
- **shockwave:** one ring expands from a click or tap.

Touch works through pointer events. Everything is off under reduced motion, and with
nothing active the warp costs one branch. Effect ages run on an effects clock that
advances per drawn frame, so `step()` is deterministic.

Checked by `pnpm measure` against a twin renderer without effects, stepped in lockstep:

| effect | cells changed | near the pointer | mean radius of changes |
|---|---:|---:|---|
| ripple | 8.7% | 62% | 8.4 cells |
| lens | 4.5% | 100% | 4.4 cells |
| shockwave | 1.4% | 100% | 2.6 → 12.9 cells over 0.35 s (expanding) |

Under emulated reduced motion nothing changes.

Two notes:
- The first version of the check compared against a frame at a different time, so it
  "found" effects even under reduced motion. The twin fixed it.
- Ripple was too faint at first (0.17% of cells). Its amplitude and reach were raised.

The website hero and the demo use `pointer: true` (ripples and a click shockwave).

Not built: exposing the pointer history (`uPointer`) to scenes. The engine-level
effects came first, and scene access is a small follow-up if someone needs it.
Criterion 1 (each effect opt-in) holds: all three default to off.
