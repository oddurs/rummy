---
id: 16
title: Art-direct the five built-in scenes
type: look
status: blocked
milestone: v0.2
depends_on:
- 7
created: 2026-09-22
updated: 2026-09-23
priority: p0
pillar: look
area: scenes
effort: l
budget: <= 2 ms GPU per scene at 1080p on an M1
---

## Now

From the first screenshots:

- `terrain`: the sun is enormous and eats the frame; its stripes barely show;
  the foreground fills with a wall of `|`, `I` and `Z`.
- `globe`: the halo outside the limb is a dense ring of `'` and `:` that reads
  as noise, not atmosphere.
- `tunnel`: too dense everywhere; the vanishing point, which should be the
  focus, is the least legible part.
- `ring` and `blobs`: fine, but lit flat; no specular pop, no sense of material.

## Target

Each scene composed for a hero: a clear focal point, negative space where
copy sits (with `offset`), one element that moves at a readable speed, and a
still frame worth using as a poster.

## Approach

One scene at a time, with the screenshot harness open. Use the tone range
deliberately: most of the frame in the middle of the glyph ramp, highlights
reserved for the focal point. Tune after the engine-side look items land, not
before, or we tune twice.

## How we judge it

The contact sheet: every scene × palette. Someone who has not seen the old
versions picks the new ones.

## Acceptance criteria

- [x] Before/after contact sheets attached to the PR
- [ ] Every scene within `budget`
- [x] Every scene has a clear focal point at 10px and 16px
- [x] Reduced-motion still frame chosen deliberately per scene

## Built in 0.2

All five scenes reworked with the contact sheet open:

- **terrain:** now a valley between ridges with a perspective grid on the floor, drawn
  as `/ \ | _`. The sun is smaller, with visible bands, and there are stars. Two bugs
  found by looking:
  - The grid function was inverted (lit cells, dark lines).
  - `fwidth()` after the raymarch's early exits is undefined (SwiftShader returns 0).
    Line width is now computed from the ray footprint.
  - Also fixed a scale problem: lines 2 units apart with the camera 0.55 up put one
    line in the near half of the frame.
- **terrain perf:** the march is capped by an analytic floor-plane hit and uses 3
  octaves (4 for shading). The scene pass dropped from 2.46 to 0.86 ms at 1080p on an M4.
- **tunnel:** a wireframe. Bright seams on near-black panels, fading into the distance.
- **globe:** a thin day-side atmosphere instead of a band of `'''`. Darker continents and
  ocean so both sit mid-ramp; the graticule is visible, with an ocean glint.
- **blobs:** a bigger, merged cluster lit like a studio product shot, with fill, fresnel
  and specular.
- **ring:** more contrast in the lighting, plus a reflection gradient so flat faces have
  something to draw.

Stills are chosen per scene and declared in the GLSL (`#define STILL t`). Rummy starts
there, and it is the reduced-motion frame, so this works for user scenes too.

Budget: every scene totals ≤ 1.73 ms at 1080p **on an M4**. The budget is written
against an M1, which hasn't been measured, so criterion 2 stays open.

## Before/after

v0.1 vs v0.2 images for ring, terrain and globe are in the PR #1 description; every scene in every look is in its `shots` artifact.

## Closed out in PR #4

Blobs lighting toned down after the silhouette work: the interior was a wall of `$@`. **Blocked on hardware** for criterion 2. The M1 attempt through CI measured the VM's paravirtualized GPU, not an M1 (see the GPU-timing item). On the M4 every scene totals ≤ 1.73 ms at 1080p.
