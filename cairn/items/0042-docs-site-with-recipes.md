---
id: 42
title: Docs site with recipes
type: docs
status: idea
milestone: v1.0
depends_on:
- 40
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: launch
area: docs
effort: m
---

A documentation site generated alongside the demo, with live examples rather
than screenshots:

- Getting started for script tag, npm, React and Webflow
- Recipes: hero behind a headline; transparent over an image; scroll-driven
  camera; your logo; a three.js scene; a video
- Writing scenes: the contract, the helpers, `#define STILL`, `uDetail`,
  performance advice ("you are shading about 5% of the pixels; spend it")
- Full API reference, generated from the types
- `how-it-works.md` as a proper illustrated article

## Acceptance criteria

- [ ] Every recipe is a live, editable example
- [ ] API reference generated, not hand-written
