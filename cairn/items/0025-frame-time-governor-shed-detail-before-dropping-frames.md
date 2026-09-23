---
id: 25
title: 'Frame-time governor: shed detail before dropping frames'
type: perf
status: idea
milestone: v0.3
depends_on:
- 8
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: speed
area: engine
effort: m
---

## Where the time goes

Scenes are designed on fast machines. On a weak phone GPU, a 100-step
raymarch at 3× DPR can miss the frame budget, and a background that stutters is
worse than a simpler one that doesn't.

## Proposal

A governor watching GPU time (from `stats.gpu`) or frame time, stepping down in
order until the frame fits, and back up with hysteresis:

1. `uDetail` 1 → 0.5 (a uniform scenes use to scale step counts and octaves;
   built-ins honour it)
2. cap DPR for the scene pass only (text stays crisp; the scene gets coarser)
3. frame rate 60 → 30

Exposed as `adaptive: true` (default) and `stats.level`.

## Before → after

| | before | after |
|---|---|---|
| worst scene, mid Android | unknown | holds 60 or steps down cleanly |

## Acceptance criteria

- [ ] Built-in scenes honour `uDetail`
- [ ] No oscillation between levels
- [ ] Measured on at least one low-end device
