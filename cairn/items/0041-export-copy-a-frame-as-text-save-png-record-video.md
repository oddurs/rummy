---
id: 41
title: 'Export: copy a frame as text, save PNG, record video'
type: feature
status: idea
milestone: v1.0
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: launch
area: api
effort: m
---

## Problem

People want to take the output somewhere: a README, a terminal, a tweet, a
slide. Only a screenshot works today.

## Proposal

- `rummy.toText()`: read back the glyph target (one small readback, cells not
  pixels) and return the frame as a string, optionally with ANSI colour codes.
  Pastes into a terminal or a code block. Nobody else can do this cheaply,
  because nobody else knows which glyph is in each cell.
- `rummy.toBlob()` for PNG.
- `rummy.record({ seconds })` for WebM via `MediaRecorder` on `captureStream`.
- Demo buttons for all three.

## Cost

Readback only when asked. Recording costs what the encoder costs.

## Acceptance criteria

- [ ] Text export matches the screen cell for cell
- [ ] ANSI export looks right in a truecolour terminal
- [ ] 10-second WebM recording at 60 fps from the demo
