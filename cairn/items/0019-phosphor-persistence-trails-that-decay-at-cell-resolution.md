---
id: 19
title: 'Phosphor persistence: trails that decay at cell resolution'
type: look
status: idea
milestone: v0.3
depends_on:
- 18
created: 2026-09-22
updated: 2026-09-22
priority: p2
pillar: motion
area: engine
effort: s
budget: <= 0.05 ms GPU at 1080p
---

## Now

Moving bright objects leave nothing behind. On a real phosphor screen, lit
characters fade over tens of milliseconds, so motion leaves a short afterglow.

## Target

`persistence: 0..1`. Bright glyphs linger and fade toward the background,
dimmer each frame, and a new glyph always wins over a fading one.

## Approach

Uses the history buffer from glyph-boil work: store per-cell brightness, decay
it by `persistence` per frame (frame-rate independent: `pow(p, dt*60)`), and
keep the old glyph at the decayed brightness when the new cell is darker. All at
cell resolution, so the cost is a rounding error.

## How we judge it

`blobs` and a dropped video; must not smear under reduced motion (off there).

## Acceptance criteria

- [ ] Before/after recording attached to the PR
- [ ] Frame-rate independent decay (same look at 30 and 120 fps)
- [ ] Off under prefers-reduced-motion
