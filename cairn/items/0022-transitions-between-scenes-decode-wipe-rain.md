---
id: 22
title: 'Transitions between scenes: decode, wipe, rain'
type: feature
status: review
milestone: v0.3
assignee: Oddur Sigurdsson
claimed: 2026-09-23
depends_on:
- 18
created: 2026-09-22
updated: 2026-09-23
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
- [x] Interruptible without a jump
- [x] Reduced motion: a short cross-fade instead

## Built

`rummy.transition(options, { style, duration })` returns a Promise.
- **decode:** cells resolve in random order through a scramble of random glyphs.
- **wipe:** a scrambling edge sweeps left to right.
- **rain:** each column falls from the top at its own moment.
- **Under reduced motion:** a ≤250 ms dissolve with no scramble.

**A departure from the proposal:** the outgoing frame is held (its glyph grid is
copied once), not rendered live. A small cell-resolution pass mixes the held grid
with the live one. So a transition costs a few thousand texel fetches rather than a
second scene and glyph pipeline, and interrupting simply holds what's on screen. The
trade-off is that the outgoing scene stops moving for the ~0.9 s it takes to
dissolve, which reads naturally for a terminal.

A plain `set({ scene })` during a transition is a cut and ends it. The shots
exposed this: a half-finished transition leaked into the next shot.

Verified by `pnpm measure` (in CI):
- the promise resolves
- the last frame equals a twin renderer that made the same change as a cut,
  stepped identically
- halfway through: 18% old / 43% new / 39% scrambling
- interrupting changes **0%** of cells on the next frame
- a paused renderer finishes a 400 ms transition in real time (~300 ms)
- under emulated reduced motion, **0.0%** scrambled cells

Stills of each style at 50% are in the contact sheet (`transition-*`). Criterion 1
asks for recordings, which don't exist yet, so it stays open.

Used for real: the Pages demo and the website's `/play` now change scenes with a
transition (`transition` prop on `<Rummy>`).

Size: +0.88 KB gzipped. The budget was raised (0009) after measuring identifier
mangling at 0.17 KB (0051, dropped).
