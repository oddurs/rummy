---
id: 35
title: React component
type: feature
status: idea
milestone: v0.5
depends_on:
- 33
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: reach
area: adapters
effort: s
---

## Problem

Most marketing sites that would use this are React (Next.js). Wiring a class
with refs, effects and cleanup by hand is where people get strict-mode double
mounts and leaked contexts wrong.

## Proposal

`@oddurs/rummy/react`: `<Rummy scene={scenes.ring} fg="#ffb000" />`, props
mapped to `set()`, SSR-safe (renders an empty canvas on the server, starts on
mount), and handles strict-mode double effects without creating two contexts.
Vue and Svelte wrappers only if asked for; the web component covers them.

## Cost

Separate entry; React as a peer dependency of that entry only.

## Acceptance criteria

- [ ] Works in a Next.js app router page with SSR
- [ ] No context leak under strict mode (verified)
- [ ] Prop changes never recreate the context
