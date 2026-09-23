---
id: 26
title: 'Your logo in 3D: SVG to extruded ASCII solid'
type: feature
status: planned
milestone: v0.4
depends_on:
- 20
created: 2026-09-22
updated: 2026-09-22
priority: p0
pillar: content
area: scenes
effort: l
budget: <= 1.5 ms GPU at 1080p
---

## Problem

The most common thing a company wants in its hero is *its own mark*. Today
that means writing an SDF by hand. This is the feature that turns rummy from a
cool effect into something a design team picks.

## Proposal

```ts
new Rummy(canvas, { scene: await scenes.logo('/mark.svg', { depth: 0.3, bevel: 0.04, spin: 0.2 }) });
```

- Rasterize the SVG to a 2D signed distance field once, on the CPU or with a
  jump-flood pass on the GPU, into a texture (~256² is plenty at cell
  resolution).
- Scene: raymarch an extrusion of that 2D SDF (`max(d2d(p.xy), abs(p.z) - depth)`)
  with a rounded bevel, lit like `ring`, turning toward the pointer and tilting
  with scroll.
- Works for any single-colour mark; multi-colour SVGs use the fill colours as
  material colour.

## Cost

One-time SDF build (< 50 ms). Per frame, a textured raymarch at cell
resolution.

## Acceptance criteria

- [ ] Five real-world logos render recognisably at 12px
- [ ] Holes (counters in letters) are correct
- [ ] SDF build under 50 ms on a laptop
- [ ] Demo: drop an SVG to see your logo
