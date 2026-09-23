---
id: 21
title: Scroll-driven scenes
type: feature
status: shipped
milestone: v0.3
assignee: Oddur Sigurdsson
claimed: 2026-09-23
depends_on:
- 20
created: 2026-09-22
updated: 2026-09-23
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

- [x] `uScroll` available in every scene, 0..1
- [x] At least two built-in scenes respond to it
- [x] No layout thrash (one rect read per frame, none when paused)

## Built

- `uScroll` goes from 0 (canvas top at the viewport top) to 1 (scrolled out),
  smoothed like `uMouse`.
- `scroll: true | false | number`. A number pins it, for scrubbers, your own scroll
  timelines, and deterministic shots.
- Under prefers-reduced-motion it stays at 0, since scroll-linked motion is a
  well-known vestibular trigger.

Scenes:
- **ring:** pulls back and turns away
- **terrain:** the camera climbs over the valley and tips down
- **globe:** recedes and spins
- **tunnel:** flies forward

The `*-scrolled` shots pin 0.6.

Checked by `pnpm measure` (in CI), with a test scene that draws `uScroll` as a fill:
- half-scrolled page → 50%
- pinned 0.25 → 25%
- exactly **1.00** `getBoundingClientRect` per frame while running
- **0** while paused (the loop doesn't run, so nothing reads layout)
