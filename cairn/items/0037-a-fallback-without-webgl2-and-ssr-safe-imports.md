---
id: 37
title: A fallback without WebGL2, and SSR-safe imports
type: feature
status: idea
milestone: v0.5
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: reach
area: api
effort: s
---

## Problem

`new Rummy()` throws without WebGL2 (old devices, locked-down browsers, some
headless crawlers), and importing the module on a server touches `window`. A
background must never be the reason a page breaks.

## Proposal

- Importing never touches the DOM; everything waits for the constructor.
- `fallback: 'poster' | 'none' | HTMLElement`. `poster` renders one frame as
  real text in a `<pre>` from a pre-baked frame shipped with each built-in scene
  (a few KB of characters), so the fallback still looks like the product.
- `Rummy.supported()` static check.
- `onError` callback for shader compile errors in user scenes; the default
  logs once and shows the fallback instead of a blank canvas.

## Cost

Poster frames are per scene and tree-shaken with the scene.

## Acceptance criteria

- [ ] Import in Node without errors
- [ ] With WebGL2 disabled, the page shows the poster, not a blank canvas or an error
- [ ] A broken user shader never throws out of the constructor
