---
id: 31
title: Ocean at night
type: scene
status: idea
milestone: v0.4
created: 2026-09-22
updated: 2026-09-22
priority: p3
pillar: content
area: scenes
effort: m
budget: <= 2 ms GPU at 1080p
---

## Concept

A calm swell under a low moon; a glittering path of moonlight on the water.

## Why it works as a hero

Calm, slow and wide: it suits brands that don't want sci-fi. The glitter path
exercises the whole glyph ramp; the sky above is free space for copy.

## Technique

Heightfield of summed Gerstner waves, raymarched like `terrain`; specular from
the moon gives the glitter.

## Acceptance criteria

- [ ] Reads well at 10px and at 16px
- [ ] Looks right in every demo palette, mono and scene colour
- [ ] Holds `budget` on the reference laptop
- [ ] Has a still frame worth showing under reduced motion
