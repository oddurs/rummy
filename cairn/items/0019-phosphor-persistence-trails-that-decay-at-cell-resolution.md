---
id: 19
title: 'Phosphor persistence: trails that decay at cell resolution'
type: look
status: review
milestone: v0.3
assignee: Oddur Sigurdsson
claimed: 2026-09-23
depends_on:
- 18
created: 2026-09-22
updated: 2026-09-23
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
- [x] Frame-rate independent decay (same look at 30 and 120 fps)
- [x] Off under prefers-reduced-motion

## Built

`persistence: 0..1`: the share of brightness kept per 1/60 s. A small cell-resolution
pass keeps a double-buffered afterglow grid. Last frame's glyph, dimmed, stays in a
cell while it still outshines what this frame put there, so a new glyph always wins
once it's brighter. It's allocated only while persistence is on, and it's off under
reduced motion and for still frames.

**The measurement caught a real bug.** `pnpm measure` counts how far the trail
behind a moving dot reaches after one second stepped at 60 fps and at 30 fps. The
first result was 46 vs 27 columns. The decay was frame-rate independent on paper,
but colours are stored in 8 bits: 3/255 × 0.85 = 2.55 rounds back to 3, so faint
trails stalled and never finished fading, stalling differently at each frame rate.
A small linear fade per second on top of the exponential guarantees progress. Now
**19 vs 19 columns**, 8 with persistence off, and 8 under emulated reduced motion.

The demo's `crt` look uses it (0.8). Shots `blobs-persistence` and
`blobs-no-persistence` step a second of motion.

Criterion 1 asks for a recording, which doesn't exist yet.
