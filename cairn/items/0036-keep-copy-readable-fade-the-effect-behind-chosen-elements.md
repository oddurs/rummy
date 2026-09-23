---
id: 36
title: 'Keep copy readable: fade the effect behind chosen elements'
type: feature
status: idea
milestone: v0.5
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: reach
area: engine
effort: s
---

## Problem

A hero is a background *for text*. Right now readability over it is the
page's problem, solved with a translucent box (as the demo does). A busy scene
behind a headline fails contrast checks and looks cluttered.

## Proposal

`mask: [elementOrSelector, ...]` with `maskFade` and `maskStrength`: rummy
tracks those elements' rects (ResizeObserver plus scroll) and dims or clears
cells behind them, with a soft falloff measured in cells. Because it works per
cell, the edge of the cleared area is a clean character boundary, which looks
deliberate rather than like a blur.

## Cost

A handful of rects as uniforms; one distance check per cell.

## Acceptance criteria

- [ ] Demo headline readable with no backing box
- [ ] Tracks layout changes and scroll
- [ ] Headline over the busiest scene passes WCAG AA contrast
