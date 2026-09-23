---
id: 50
title: 'The headline as geometry: SDF text inside the scene'
type: feature
status: idea
milestone: later
created: 2026-09-22
updated: 2026-09-22
priority: p3
pillar: content
area: scenes
effort: l
---

## Problem

The hero's copy and its background are separate layers. The most striking
version would have the headline *in* the scene: extruded, lit, drawn in the
same characters, with the camera moving around it.

## Proposal

Reuse the logo pipeline: rasterize text with a given font to an SDF, extrude
it, and composite with a scene. Keep the real DOM headline for accessibility
and SEO, visually hidden or overlaid.

## Cost

Same as the logo scene.

## Acceptance criteria

- [ ] A headline readable as geometry at hero sizes
- [ ] Real text remains in the DOM
