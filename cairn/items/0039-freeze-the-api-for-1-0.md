---
id: 39
title: Freeze the API for 1.0
type: chore
status: idea
milestone: v1.0
created: 2026-09-22
updated: 2026-09-22
priority: p0
pillar: launch
area: api
effort: m
breaking: 'true'
---

Review every option, method, uniform and scene helper before promising
stability. Things already suspect:

- `colorMix` vs a palette system: one of them probably becomes a mode.
- `directionalContrast` and `contrast` are exponents with non-obvious ranges;
  they may want to become 0..1 strengths.
- The scene contract (`vec4 scene(vec2 uv)`, depth in alpha) must leave room
  for normals and extra outputs without a second breaking change.
- Helper names in the GLSL prelude (`rot`, `noise`, `fbm`) can collide with
  user code; prefix or namespace them now or never.

Everything that changes gets `breaking=true` on its own item; the `breaking`
view is the checklist.

## Acceptance criteria

- [ ] `cairn list --view breaking` is empty
- [ ] Public API documented in full, generated from types where possible
- [ ] Migration notes from 0.x
