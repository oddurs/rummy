---
id: 48
title: Is a WebGPU backend worth it?
type: spike
status: idea
milestone: later
created: 2026-09-22
updated: 2026-09-22
priority: p3
pillar: speed
area: engine
effort: s
---

## Question

Does WebGPU buy anything for this workload: compute-shader glyph matching,
cheaper passes, better mobile power? Or is WebGL2 already enough for a few
fullscreen draws at low resolution?

## Why it matters

A second backend doubles the shader surface. It is only worth it for a
measured win or a capability WebGL2 lacks.

## What we tried

## Answer

## Decision
