---
id: 49
title: 'Weight as tone: bold and light atlases chosen by brightness'
type: look
status: idea
milestone: later
created: 2026-09-22
updated: 2026-09-22
priority: p3
pillar: look
area: atlas
effort: m
---

## Now

One font weight. The tonal range is limited by the densest glyph in one weight.

## Target

Highlights in bold, shadows in light: more tonal range and a typographic
texture no brightness ramp has.

## Approach

Build atlases for two or three weights, give each glyph-weight pair its own
shape vector, and match across all of them. Charset size effectively triples,
which may be what finally justifies the lookup-table matcher.

## How we judge it

Contact sheet, `ascii` charset, mono palettes.

## Acceptance criteria

- [ ] Before/after screenshots attached to the PR
- [ ] Works with any variable font
