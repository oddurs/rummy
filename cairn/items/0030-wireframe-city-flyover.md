---
id: 30
title: Wireframe city flyover
type: scene
status: idea
milestone: v0.4
created: 2026-09-22
updated: 2026-09-22
priority: p2
pillar: content
area: scenes
effort: m
budget: <= 2 ms GPU at 1080p
---

## Concept

Flying low over an endless grid of towers at night, edges lit, windows
flickering, a fog horizon. Vector-display energy (Tron, Battlezone), but solid.

## Why it works as a hero

Perspective lines give strong `/`, `\` and `|` strokes, which is where shape
matching shines. Scroll drives altitude.

## Technique

Domain-repeated boxes with per-cell hashed heights, raymarched with a
grid-traversal step to stay cheap; edges from the silhouette work.

## Acceptance criteria

- [ ] Reads well at 10px and at 16px
- [ ] Looks right in every demo palette, mono and scene colour
- [ ] Holds `budget` on the reference laptop
- [ ] Has a still frame worth showing under reduced motion
