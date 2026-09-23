---
id: 24
title: 'An intro worth the first second: type-on reveal'
type: feature
status: idea
milestone: v0.3
created: 2026-09-22
updated: 2026-09-22
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
- [ ] Skipped entirely under reduced motion
- [ ] Never delays first paint
