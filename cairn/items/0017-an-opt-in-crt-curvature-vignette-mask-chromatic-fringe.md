---
id: 17
title: 'An opt-in CRT: curvature, vignette, mask, chromatic fringe'
type: look
status: review
milestone: v0.2
created: 2026-09-22
updated: 2026-09-22
priority: p2
pillar: look
area: engine
effort: s
budget: <= 0.2 ms GPU at 1080p
---

## Now

`scanlines` is the only screen effect.

## Target

`crt: { curvature, vignette, mask, fringe, flicker }`, all zero by default, with
a `crt: true` shorthand for a tasteful preset. Subtle is the point; the
overdone version is everywhere already.

## Approach

All in the composite pass, which already touches every pixel once: barrel
distortion of the lookup coordinates, a vignette multiply, an aperture-grille
mask by pixel column, and a one-pixel R/B offset of the atlas lookup. Flicker
is a tiny time-varying gain. Must respect reduced motion (no flicker).

## How we judge it

Side by side with a reference photo of a real terminal.

## Acceptance criteria

- [ ] Before/after screenshots attached to the PR
- [x] Frame cost within `budget`
- [x] Glyphs stay crisp at the centre of the screen with curvature on
- [x] No flicker under prefers-reduced-motion

## Built in 0.2

`crt: true | { curvature, vignette, mask, fringe, flicker }`, all in the composite pass:

- barrel distortion of the lookup coordinate
- aperture-grille RGB mask by pixel column
- vignette
- a one-device-pixel red/blue offset of the atlas lookup for fringe
- a small random gain for flicker, only while animating, so never under reduced motion

The demo's `crt` look pairs it with amber, glow and scanlines.

Evidence: demo screenshot with `look=crt` shows centre glyphs crisp and curvature at
the edges. Bench, crt on vs off: within noise. Flicker is gated on `animating`, which
is false under reduced motion.
