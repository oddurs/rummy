---
id: 54
title: Deploy the website to Railway
type: chore
status: idea
milestone: v0.5
created: 2026-09-23
updated: 2026-09-23
priority: p1
pillar: reach
area: infra
effort: s
---

`web/` needs a Node server (`/roadmap` renders per request), so GitHub Pages can
only host the static `demo/` harness. Railway is the target.

- One service from the repo: build `pnpm install && pnpm web:build`, start
  `pnpm web:start`, health check `/healthz`.
- Set `ORIGIN` to the public URL (CSRF checks, HSTS). Keep `cairn/items` in the
  image so `/roadmap` reads live; otherwise it falls back to the build snapshot.
- Deploy from `main` only, after CI; PR previews would be nice but optional.
- A custom domain if there is one.

## Acceptance criteria

- [ ] The site is served from Railway with HTTPS and passes its health check
- [ ] Security headers and CSP verified on the public URL
- [ ] Deploys happen automatically from main
