---
id: 8
title: Measure GPU time per pass and put it in stats
type: perf
status: review
milestone: v0.2
created: 2026-09-22
updated: 2026-09-22
priority: p0
pillar: speed
area: engine
effort: m
---

## Where the time goes

Unknown, which is the problem. `stats.fps` is rAF cadence, which says nothing
until we drop below the display rate, and by then it is too late. Every look
item in this milestone adds GPU work, and "costs nothing" is the product. We
need the number before we spend it.

## Proposal

- Wrap each pass in `EXT_disjoint_timer_query_webgl2` queries (when present),
  read results a few frames later without stalling, and expose
  `stats.gpu = { scene, glyph, composite, total }` in milliseconds.
- A `demo/bench.html` page that runs each scene for 10 seconds at 1080p and
  4K-equivalent sizes and prints a table, so numbers can be pasted into issues.
- A `budget` on every scene and look item, checked against this.

Timer queries are unavailable on some browsers (Safari, and Chrome on some
drivers). There, fall back to CPU-side frame time and say so in the output;
never report a guess as a GPU number.

## Before → after

| | before | after |
|---|---|---|
| per-pass GPU time | invisible | in `stats.gpu` |

## Acceptance criteria

- [x] `stats.gpu` reports per-pass milliseconds where the extension exists
- [x] Queries never stall the pipeline (no same-frame reads)
- [x] Bench page produces a pasteable table for all scenes
- [ ] Reference numbers recorded here for an M-series Mac and one mid-range Android

## Built in 0.2

`profile: true` fills `stats.gpu` from `EXT_disjoint_timer_query_webgl2`;
`demo/bench.html` plus `scripts/bench.mjs` (headless Chrome on the real GPU, Metal on
macOS) print a Markdown table.

**The first design was wrong, and the bench showed it.** One query per pass, back to
back, reported running totals on ANGLE/Metal: glyph ≈ scene + a bit, composite ≈
everything. Flushing between passes didn't help. The timer now opens one query per
frame at the top and closes it after one pass, rotating which pass. Each sample is
cumulative, and per-pass cost is the difference. That is correct whether or not the
backend times queries exactly. Results are read frames later and never waited on.

Reference, Apple M4, headless Chrome 153, 1080p, 12px, phosphor look with glow:

| scene | scene | glyph | glow | composite | total |
|---|---:|---:|---:|---:|---:|
| ring | 0.26 | 0.29 | 0.11 | 0.60 | 1.25 |
| terrain | 0.86 | 0.30 | 0.05 | 0.52 | 1.73 |
| blobs | 0.86 | 0.25 | 0.17 | 0.28 | 1.55 |
| globe | 0.26 | 0.35 | 0.23 | 0.46 | 1.30 |
| tunnel | 0.23 | 0.30 | 0.07 | 0.38 | 0.98 |

Per-pass numbers carry about ±0.2 ms of noise; totals are steadier.

**Still missing:** Android. It needs a real device (`/bench.html` in a browser). An
M1 number would also be good, since scene budgets are written against it.
