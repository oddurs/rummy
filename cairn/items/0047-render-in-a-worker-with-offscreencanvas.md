---
id: 47
title: Render in a worker with OffscreenCanvas
type: perf
status: idea
milestone: later
created: 2026-09-22
updated: 2026-09-22
priority: p3
pillar: speed
area: engine
effort: m
---

## Where the time goes

rummy's main-thread work is small (uniforms and a handful of draws), but on a
busy page (hydration, analytics) even small rAF work can drop frames, and a
janky main thread janks the background.

## Proposal

`worker: true` transfers the canvas to a worker via
`transferControlToOffscreen`; options and pointer events are posted across.
Font atlas building needs `OffscreenCanvas` 2D and fonts in the worker
(`FontFace` in workers), which needs checking per browser.

## Acceptance criteria

- [ ] Identical output with and without the worker
- [ ] Background keeps its frame rate while the main thread is blocked for 200 ms
