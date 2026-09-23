---
id: 20
title: Custom uniforms, settable live
type: feature
status: planned
milestone: v0.3
created: 2026-09-22
updated: 2026-09-22
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

- [ ] float, vec2–4, bool and texture uniforms work
- [ ] `set({ uniforms })` merges and never recompiles
- [ ] Documented, with an example scene that uses one
