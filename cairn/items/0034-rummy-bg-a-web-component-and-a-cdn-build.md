---
id: 34
title: '<rummy-bg>: a web component and a CDN build'
type: feature
status: planned
milestone: v0.5
depends_on:
- 33
created: 2026-09-22
updated: 2026-09-22
priority: p0
pillar: reach
area: adapters
effort: m
---

## Problem

The people who want a hero background most are often not writing a bundled
TypeScript app: Webflow, Framer, WordPress, a static page. For them, anything
that needs `npm install` and a build step is a no.

## Proposal

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@oddurs/rummy/dist/element.js"></script>
<rummy-bg scene="terrain" preset="synthwave" font-size="12"></rummy-bg>
```

- A custom element that fills its parent, maps attributes to options
  (kebab-case to camelCase, typed), and cleans up on disconnect.
- A `<script type="x-glsl">` child as the scene, so custom scenes work with no JS.
- A separate `element.js` entry, so the core import doesn't register elements.

## Cost

A separate entry point; core unchanged.

## Acceptance criteria

- [ ] Works on a plain HTML page from the CDN with no build
- [ ] Every option settable as an attribute; changes apply live
- [ ] Inline GLSL child works
- [ ] Tested in a Webflow or Framer embed
