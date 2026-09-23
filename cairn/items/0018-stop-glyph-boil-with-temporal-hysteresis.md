---
id: 18
title: Stop glyph boil with temporal hysteresis
type: look
status: planned
milestone: v0.3
depends_on:
- 7
- 8
created: 2026-09-22
updated: 2026-09-22
priority: p0
pillar: motion
area: engine
effort: m
budget: <= +0.1 ms GPU at 1080p
---

## Now

In motion, cells on a smooth gradient flip between near-equal glyphs every
frame (`I`↔`l`, `Z`↔`2`, `:`↔`;`). The eye reads it as shimmering noise, a
"boil", and it is the single most visible flaw in animated ASCII, ours
included. It is worst on slow camera moves, which are exactly what a hero
background does.

## Target

A slow-moving scene looks like it is moving, not fizzing. Glyphs change when
the shape under them changes, and not because of sub-threshold noise.

## Approach

- Keep last frame's glyph target (ping-pong two textures; the glyph pass
  already renders to one).
- In the matcher, add a bonus to the previous glyph: keep it unless the new
  best beats it by a margin (`stability`, default ~10% of distance). This is
  hysteresis, the same trick as a Schmitt trigger.
- Optionally smooth the six region tones over time (EMA) before matching, which
  helps video sources with sensor noise.
- Measure: a `stats.churn` (% of cells whose glyph changed this frame), computed
  only on the bench page.

The history buffer is also what phosphor trails and temporal jitter need, so
build it once, generally.

## How we judge it

Screen recordings of `terrain` and `ring` at 0.5× speed, before and after, and
the churn number.

## Acceptance criteria

- [ ] Before/after recordings attached to the PR
- [ ] Churn on `terrain` cut by at least half with no visible lag on fast motion
- [ ] Frame cost within `budget`
- [ ] `stability: 0` reproduces today's output exactly
