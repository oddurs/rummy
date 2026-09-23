---
id: 40
title: 'Playground: edit a scene''s GLSL live and share it by URL'
type: feature
status: idea
milestone: v1.0
depends_on:
- 20
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: launch
area: demo
effort: m
---

## Problem

The fastest way to understand what rummy can do is to change a scene and
watch it. Today that needs a clone and a dev server.

## Proposal

A playground page: code editor (CodeMirror, loaded only on that page) beside a
live preview, recompiling on pause in typing, errors shown inline at the right
line (we already number compile logs), the current scene and settings encoded
in the URL (compressed) so any experiment is one link. Starter templates:
raymarch, 2D field, image source.

## Cost

Demo site only; nothing in the library.

## Acceptance criteria

- [ ] Edit, see it, share a link that reproduces it exactly
- [ ] Compile errors point at the line
- [ ] Works on a phone (read-only is fine)
