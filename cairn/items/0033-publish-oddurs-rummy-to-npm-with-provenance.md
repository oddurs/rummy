---
id: 33
title: Publish @oddurs/rummy to npm with provenance
type: chore
status: planned
milestone: v0.5
created: 2026-09-22
updated: 2026-09-22
priority: p0
pillar: reach
area: infra
effort: s
---

`rummy` on npm belongs to an unrelated package (v0.2.0), so the package is
`@oddurs/rummy`; the repo and the product keep the name.

- Release workflow on tag: `pnpm check`, then `npm publish --provenance --access public`
- Changelog generated from items closed in the milestone (`cairn list
  --filter milestone=vX,category=done`), with `breaking=true` items first
- Semver from 0.5 on: minor for features, patch for fixes; anything
  `breaking=true` bumps minor until 1.0
- `exports` map checked with `publint` and `@arethetypeswrong/cli` in CI

## Acceptance criteria

- [ ] Tag push publishes with provenance
- [ ] publint and attw clean
- [ ] README install instructions work from a fresh project
