---
id: 52
title: Mangle GLSL identifiers in the build
type: perf
status: idea
milestone: later
created: 2026-09-22
updated: 2026-09-22
priority: p3
pillar: speed
area: infra
effort: m
---

## Where the time goes

Measured in 0.2: GLSL is roughly 10 KB of the 13.7 KB gzipped library. The
build already strips comments and whitespace; what remains is identifiers.
The original 0.2 targets (12 KB for the whole library, ~6 KB for the core) are
out of reach without shortening them.

## Proposal

A build-time pass that renames locals and helper functions inside each shader.
Uniform names are looked up from JS by name, so they either stay or get
renamed on both sides through a generated map.

## Before → after

| | before | after |
|---|---|---|
| library, gzipped | 13.7 KB | to measure |
| core (`Rummy` only), gzipped | 11.9 KB | to measure |

## Acceptance criteria

- [ ] Contact sheet unchanged
- [ ] Size budgets in `scripts/size.mjs` lowered to the new measured values
