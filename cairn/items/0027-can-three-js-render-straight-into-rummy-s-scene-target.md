---
id: 27
title: Can three.js render straight into rummy's scene target?
type: spike
status: idea
milestone: v0.4
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: content
area: adapters
effort: s
---

## Question

Can a three.js `WebGLRenderer` share rummy's WebGL2 context and render its
scene (colour and depth) into rummy's cell-resolution scene target, so a
three.js scene is asciified with no canvas copy and at ~5% of the pixel cost?

## Why it matters

Today a three.js scene can only come in as a canvas source: rendered at full
resolution (all the cost rummy exists to avoid), then uploaded as a texture
every frame. Sharing the context removes both.

## What we tried

(to fill in)

Things to check: `new WebGLRenderer({ canvas, context })` against our context;
state leakage between three and our passes (three caches GL state; we must
call `renderer.resetState()` after it runs); getting depth from three into our
alpha channel (a `MeshDepthMaterial` override pass, or reading three's depth
texture); whether R3F can be pointed at an external context.

## Answer

## Decision
