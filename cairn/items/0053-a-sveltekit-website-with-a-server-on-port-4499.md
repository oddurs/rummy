---
id: 53
title: A SvelteKit website with a server, on port 4499
type: feature
status: shipped
milestone: v0.3
assignee: Oddur Sigurdsson
claimed: 2026-09-22
created: 2026-09-22
updated: 2026-09-23
priority: p1
pillar: launch
area: demo
effort: m
---

## Problem

The demo is a single static page built for testing: a hero, a tuner, a contact
sheet and a bench. rummy needs a real website: a landing page that sells it,
live scenes, a playground and the roadmap. A server gives the site things static
hosting can't: rendering the roadmap from the cairn items at request time, a
health endpoint for deploys, and real security headers.

## Proposal

A SvelteKit app in `web/` (a pnpm workspace package) using `adapter-node`:

- `/`: a hero rendered by rummy behind the headline, live scene tiles, the pitch
  (how it works, what it costs) and install snippets.
- `/play`: the full tuner, every option live, with state in the URL.
- `/roadmap`: rendered on the server from `cairn/items/*.md`, with progress per
  milestone.
- `/healthz`: JSON health check for deploy targets.
- A `<Rummy>` Svelte component that owns the instance lifecycle; it is a first
  draft of the framework adapters in v0.5.
- Dev and prod both on port 4499. Fonts self-hosted (no third-party requests), a
  strict CSP, security headers from `hooks.server.ts`.
- The library imported from `src/` through an alias, so library edits hot-reload
  in the site.

`demo/` stays as the screenshot and bench harness.

## Cost

Nothing in the library bundle. CI gains a web check and build job.

## Acceptance criteria

- [x] `pnpm web` serves the site on http://localhost:4499 with HMR, including library edits
- [x] `pnpm web:build && pnpm web:start` runs the Node server on 4499 (PORT overrides)
- [x] `/roadmap` renders from the cairn items on the server
- [x] `/healthz` returns JSON
- [x] CSP and security headers on every response; no third-party requests
- [x] svelte-check clean, and a CI job that checks and builds the site

## Built

SvelteKit 2.70 / Svelte 5 (runes) with adapter-node, in a pnpm workspace package
(`web/`). Verified locally:

- `pnpm web`: Vite dev server on 4499 (`strictPort`). Serves the library from `../src`
  (`/@fs/.../src/scenes.ts` → 200), so engine edits hot-reload. Security headers are
  present in dev.
- `pnpm web:build && pnpm web:start`: a custom `start.js` wraps adapter-node's
  handler on 4499. `/healthz` returns `{"ok":true,...}`; `/roadmap` reads the items
  live ("read live from the repository"); static assets are served brotli-compressed.
- Headless Chrome on `/`, `/play`, `/roadmap` and `/` at 390px: no console errors, no
  CSP violations.

Found and fixed along the way:
- Prerendered pages bypass `hooks.server.ts`, so `/` went out without security headers.
  `start.js` now sets them on every response, from one module shared with the hook.
- Vite inlined small font subsets as `data:` URIs, which the strict `font-src 'self'`
  blocked (36 violations). Asset inlining is off rather than the CSP loosened.
- `replaceState` on `/play` threw when called from `onMount`, before the router's first
  navigation. It is now gated on `afterNavigate`.
- The nav was illegible over bright scenes on mobile; the overlay header now fades from
  the background colour.

Not done: deployment. Nothing is hosted yet. `web/README.md` covers any Node host;
Railway would be the obvious one here.

## Shipped

PR #3: all CI checks passed, including the new `web` job, which is now required on main.
