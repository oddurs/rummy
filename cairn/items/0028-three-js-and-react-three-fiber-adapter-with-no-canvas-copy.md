---
id: 28
title: three.js and React Three Fiber adapter with no canvas copy
type: feature
status: idea
milestone: v0.4
depends_on:
- 27
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: content
area: adapters
effort: m
---

## Problem

Most people with a 3D scene already have it in three.js or R3F. The canvas
source path works but pays full-resolution rendering plus a texture upload
every frame.

## Proposal

A separate entry point, `@oddurs/rummy/three`, shaped by the spike's answer:

```ts
import { RummyPass } from '@oddurs/rummy/three';
const ascii = new RummyPass(renderer, { fg: '#ffb000' });
ascii.render(scene, camera);          // three draws at cell resolution into rummy
```

and `<Ascii>` for R3F, wrapping the same thing. The core library stays
zero-dependency; three is a peer dependency of the adapter only.

## Cost

No change to the core bundle.

## Acceptance criteria

- [ ] Example: a GLTF model asciified with no canvas copy
- [ ] Depth from three drives `edges`
- [ ] Core bundle size unchanged
