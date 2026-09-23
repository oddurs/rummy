---
id: 15
title: Auto-exposure, so scenes and video need no gain tuning
type: look
status: review
milestone: v0.2
depends_on:
- 7
created: 2026-09-22
updated: 2026-09-22
priority: p2
pillar: look
area: engine
effort: m
---

## Now

`gain` and `gamma` are global and hand-tuned. The default (0.85 / 1.15) was
chosen by eye on `ring` and `terrain`; a dark video or a bright photo lands at
either end of the glyph ramp, all `@` or all `.`.

## Target

Any source uses the full glyph range by default, and adapts smoothly when a
video cuts from dark to bright.

## Approach

Reduce the glyph target's brightness to a small histogram or a mean/max pair
(a few mip levels at cell resolution), feed it back as an exposure uniform next
frame, smooth over ~0.5 s. `exposure: 'auto' | number`. No CPU readback.

## How we judge it

A dark video, a bright photo, and all built-in scenes; auto must not make the
built-ins worse than their hand-tuned look.

## Acceptance criteria

- [ ] Before/after screenshots attached to the PR
- [x] No GPU→CPU readback
- [ ] No visible pumping on a steady scene

## Built in 0.2

`exposure: number | 'auto' | 'source'`. The default, `'source'`, is auto for images,
video and canvases and 1 for GLSL scenes, which are tuned by hand. That default is a
decision rather than the item's "any source by default": auto-exposing the built-in
scenes flattened their deliberate tonal hierarchy.

The chain is a cell-resolution luma pass writing (mean, mean²), then `generateMipmap`
down to one texel, then a 1×1 pass easing log2(exposure) toward `0.85 / (mean + 2σ)`.
It eases over ~0.5 s in motion and snaps for stills. There is no readback anywhere.

Evidence: `source-dark-auto` vs `source-dark-fixed`. The underexposed test image goes
from a few dots to a readable scene. Bench: exposure auto vs fixed within noise.

Not verified: pumping on a steady live source (criterion 3). By construction a steady
frame has a steady target, but it wants a look at a real video.
