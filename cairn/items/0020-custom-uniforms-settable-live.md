---
id: 20
title: Custom uniforms, settable live
type: feature
status: shipped
milestone: v0.3
assignee: Oddur Sigurdsson
claimed: 2026-09-23
created: 2026-09-22
updated: 2026-09-23
priority: p0
pillar: content
area: api
effort: s
---

## Problem

A user scene can read `uTime`, `uMouse` and a few built-ins, and nothing else.
To drive a scene from their own page (a colour from the theme, a value from a
slider, a progress from scroll) they have to rebuild the GLSL string, which
recompiles the program.

## Proposal

```ts
new Rummy(canvas, {
  scene: myScene,
  uniforms: { uSpeed: 1, uTint: [1, 0.4, 0.8], uLogo: someTexture },
});
rummy.set({ uniforms: { uSpeed: 2 } });   // merges; no recompile
```

Types inferred from values: number → float, 2/3/4-array → vecN, boolean → bool
(as int), `TexImageSource` → sampler2D on the next free unit. Unknown names are
ignored with a one-time dev warning (a typo should not throw in production).

## Cost

A few hundred bytes. Per frame, one `uniform*` call per custom uniform.

## Acceptance criteria

- [x] float, vec2–4, bool and texture uniforms work
- [x] `set({ uniforms })` merges and never recompiles
- [x] Documented, with an example scene that uses one

## Built

`uniforms: Record<string, UniformValue>`:
- number → `float`, boolean → `bool`, 2–4 numbers → `vec2`–`vec4`
- image/video/canvas → `sampler2D` on texture units 2 and up, uploaded y-flipped
  so `texture(uTex, uv)` lines up with the scene's y-up `uv`. Static images upload
  once; video and canvases every frame.

`set({ uniforms })` merges into the current values. Unknown names log one
`console.warn` and are skipped.

Verified by `pnpm measure` (in CI), with a test scene using all four kinds:
- each change alters the frame
- **0 shader compiles** across three `set({ uniforms })` calls, counted by
  wrapping `compileShader`
- the first `uTint` survives later partial updates
- a typo'd name produced exactly one warning and no throw

Shots `uniforms-a` and `uniforms-b` are the same shader with different values.
Documented in the README with an example scene.
