---
id: 22
title: 'Transitions between scenes: decode, wipe, rain'
type: feature
status: idea
milestone: v0.3
depends_on:
- 18
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: motion
area: engine
effort: m
---

## Problem

`set({ scene })` cuts instantly. A hero that changes scene with a section,
tab or theme should change the way a terminal would: characters resolving,
scrambling, raining in.

## Proposal

```ts
await rummy.transition({ scene: scenes.globe }, { style: 'decode', duration: 900 });
```

- Render both scenes' glyph targets during the transition (two scene passes; it
  is short and cheap at cell resolution).
- Per-cell progress from a pattern (`decode`: random per cell with a
  scramble phase through random glyphs; `wipe`: by column with a leading edge of
  bright glyphs; `rain`: by column with gravity, Matrix-style).
- Returns a promise; interrupting a transition starts from the current mix.

## Cost

2× scene cost for the duration of the transition only.

## Acceptance criteria

- [ ] Three styles, each recorded in the PR
- [ ] Interruptible without a jump
- [ ] Reduced motion: a short cross-fade instead
