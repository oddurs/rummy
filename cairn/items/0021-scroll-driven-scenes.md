---
id: 21
title: Scroll-driven scenes
type: feature
status: idea
milestone: v0.3
depends_on:
- 20
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: motion
area: api
effort: s
---

## Problem

A hero background sits at the top of a page that scrolls. Today scrolling does
nothing to the scene; the canvas just slides away. Scroll is the one input
every visitor gives, and the best hero effects use it: the camera pulls back,
the terrain drops away, the logo turns to face you as you leave.

## Proposal

- A built-in `uScroll` uniform: 0 when the canvas's top is at the viewport top,
  1 when it has scrolled fully out; smoothed like `uMouse`.
- `scroll: false` to opt out.
- Built-in scenes use it tastefully (camera dolly, tilt).
- Implemented with a passive scroll listener and one `getBoundingClientRect` per
  frame while visible, or a ScrollTimeline where available.

## Cost

Negligible; no work while the canvas is off screen (already paused there).

## Acceptance criteria

- [ ] `uScroll` available in every scene, 0..1
- [ ] At least two built-in scenes respond to it
- [ ] No layout thrash (one rect read per frame, none when paused)
