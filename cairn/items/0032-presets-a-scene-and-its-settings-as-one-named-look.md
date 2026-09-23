---
id: 32
title: 'Presets: a scene and its settings as one named look'
type: feature
status: idea
milestone: v0.4
created: 2026-09-22
updated: 2026-09-22
priority: p2
pillar: content
area: api
effort: s
---

## Problem

A good look is a scene *plus* a palette, charset, contrast, edges and glow.
Today the demo holds those combinations in its own code, and a user copying one
has to transcribe a dozen options.

## Proposal

`presets` export: `synthwave`, `mainframe`, `blueprint`, `phosphor`, `paper`,
each a plain `Partial<RummyOptions>`. `new Rummy(canvas, presets.synthwave)`, or
spread and override. The demo's "share" link and presets use the same JSON.

## Cost

Tree-shakeable; nothing if unused.

## Acceptance criteria

- [ ] Five presets, each on the contact sheet
- [ ] Demo can copy the current settings as a preset object
