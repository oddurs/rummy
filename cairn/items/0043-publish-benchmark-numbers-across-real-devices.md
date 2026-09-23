---
id: 43
title: Publish benchmark numbers across real devices
type: perf
status: idea
milestone: v1.0
depends_on:
- 8
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: launch
area: docs
effort: s
---

## Where the time goes

"Costs nothing" is the claim that makes a performance-minded developer try
rummy over a video or a heavier library, so it needs numbers anyone can check.

## Proposal

Run the bench page on a device matrix (M-series Mac, an Intel iGPU laptop, a
recent iPhone, a mid-range Android, a low-end Android) and publish per-scene
per-pass GPU time and total frame time at 1080p, plus a comparison with a
full-resolution post-process ASCII shader showing the same scene.

## Before → after

| | before | after |
|---|---|---|
| published numbers | M4 only, headless | a table in the docs, reproducible from the bench page |

## Acceptance criteria

- [ ] Five devices, all built-in scenes
- [ ] The comparison is fair: same scene, same output size
- [ ] Anyone can reproduce with the bench page
