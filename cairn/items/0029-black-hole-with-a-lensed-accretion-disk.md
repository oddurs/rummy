---
id: 29
title: Black hole with a lensed accretion disk
type: scene
status: idea
milestone: v0.4
created: 2026-09-22
updated: 2026-09-22
priority: p2
pillar: content
area: scenes
effort: m
budget: <= 2 ms GPU at 1080p
---

## Concept

A black hole seen slightly above the disk plane: the disk's far side lensed up
and over the shadow (the Interstellar look), a thin photon ring, Doppler
brightening on the approaching side.

## Why it works as a hero

A strong circular focal point with a lot of empty space around it for copy; the
disk rotates slowly, the pointer tilts the view. Reads brilliantly as ASCII
because the structure is rings and arcs, which shape matching draws as `(`, `)`,
`_` and `‾`.

## Technique

Bend rays with a cheap approximation (step the ray and add acceleration toward
the centre, ~40 steps), shade the disk with noise bands. Cell resolution means
we can afford a proper integration.

## Acceptance criteria

- [ ] Reads well at 10px and at 16px
- [ ] Looks right in every demo palette, mono and scene colour
- [ ] Holds `budget` on the reference laptop
- [ ] Has a still frame worth showing under reduced motion
