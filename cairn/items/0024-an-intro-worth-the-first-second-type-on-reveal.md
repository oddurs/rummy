---
id: 24
title: 'An intro worth the first second: type-on reveal'
type: feature
status: review
milestone: v0.3
assignee: Oddur Sigurdsson
claimed: 2026-09-23
created: 2026-09-22
updated: 2026-09-23
priority: p2
pillar: motion
area: engine
effort: s
---

## Problem

The first frame pops in fully formed. The first second on a page is when
people decide whether to look, and a terminal has a signature way of starting:
text arriving.

## Proposal

`intro: 'type' | 'scan' | 'boot' | false` (default off; the demo uses one).
Implemented as a per-cell reveal time in the composite pass: `type` reveals in
reading order with a bright cursor at the edge, `scan` sweeps a line down,
`boot` flickers cells on at random like a power-up. Duration ~0.8 s.

## Cost

One comparison per pixel, only during the intro.

## Acceptance criteria

- [ ] Three intros, recorded in the PR
- [x] Skipped entirely under reduced motion
- [x] Never delays first paint

## Built

`intro: 'type' | 'scan' | 'boot' | false`. An intro is a transition from a blank screen
and reuses the mix pass (styles 5–7), so it costs a few thousand texel fetches for
0.8 s.
- **type:** fills in reading order behind a cursor (the charset's inkiest glyph).
- **scan:** a bright line sweeps down.
- **boot:** cells flicker on at random.

The background is always the live one, so an opaque page never flashes transparent.

The first frame paints immediately, blank, with the reveal already under way. If the
web font arrives mid-intro and the grid resizes, the intro resizes its buffers and
continues instead of cutting off.

Checked by `pnpm measure`, share of the final frame shown:

| style | first frame | halfway | complete by frame |
|---|---:|---:|---:|
| type | 0% | 52% | 46 |
| scan | 0% | 77% | 34 |
| boot | 0% | 63% | 39 |

With emulated reduced motion there is no intro: the first frame is 100% complete.
Shots `intro-*` capture each style halfway.

The website's hero and the Pages demo now type themselves in.

Criterion 1 asks for recordings, which don't exist yet.
