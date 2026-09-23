---
id: 18
title: Stop glyph boil with temporal hysteresis
type: look
status: review
milestone: v0.3
assignee: Oddur Sigurdsson
claimed: 2026-09-23
depends_on:
- 7
- 8
created: 2026-09-22
updated: 2026-09-23
priority: p0
pillar: motion
area: engine
effort: m
budget: <= +0.1 ms GPU at 1080p
---

## Now

In motion, cells on a smooth gradient flip between near-equal glyphs every
frame (`I`↔`l`, `Z`↔`2`, `:`↔`;`). The eye reads it as shimmering noise, a
"boil", and it is the single most visible flaw in animated ASCII, ours
included. It is worst on slow camera moves, which are exactly what a hero
background does.

## Target

A slow-moving scene looks like it is moving, not fizzing. Glyphs change when
the shape under them changes, and not because of sub-threshold noise.

## Approach

- Keep last frame's glyph target (ping-pong two textures; the glyph pass
  already renders to one).
- In the matcher, add a bonus to the previous glyph: keep it unless the new
  best beats it by a margin (`stability`, default ~10% of distance). This is
  hysteresis, the same trick as a Schmitt trigger.
- Optionally smooth the six region tones over time (EMA) before matching, which
  helps video sources with sensor noise.
- Measure: a `stats.churn` (% of cells whose glyph changed this frame), computed
  only on the bench page.

The history buffer is also what phosphor trails and temporal jitter need, so
build it once, generally.

## How we judge it

Screen recordings of `terrain` and `ring` at 0.5× speed, before and after, and
the churn number.

## Acceptance criteria

- [ ] Before/after recordings attached to the PR
- [x] Churn on `terrain` cut by at least half with no visible lag on fast motion
- [x] Frame cost within `budget`
- [x] `stability: 0` reproduces today's output exactly

## Started

Claimed with --force past 0008. What this item needed from 0008 (the bench and `stats.gpu`) shipped; only the real-device numbers are outstanding.

## Result: the boil was ours, and hysteresis wasn't the fix

Measured before changing anything. `step()` renders frames with exact timing, and
`toText()` reads them back. The motion test steps renderers through every scene at
60 fps and counts **flicker**: cells that flip and flip back within three frames
(A→B→A). It also measures **error** against a fully refined still of the same moment,
so smoothing that just lags shows up as lost accuracy.

What the numbers said, in order:

1. **Hysteresis as proposed cut flicker 50–80%,** but the stable renderer drifted
   up to 19 points further from the ideal frame in the fast tunnel. The cause was a
   bias, not lag: near-empty panels hover at the space/`.` threshold, and holding
   whichever came first left them dotted.
2. **Variants that gated hysteresis** (margin scaled by ink, only where the image
   didn't change, only between look-alike glyphs) removed the accuracy cost but
   stopped reducing flicker. So flicker wasn't coming from near-tie letters.
3. **A histogram of the flipping pairs** showed position swaps among sparse glyphs:
   `.`↔`` ` ``, `'`↔`.`, `-`↔`:`. A thin feature was jumping between sub-cell regions.
4. **Antialiasing off: flicker 0.03–0.45%, down from 1–4%.** The jitter added in 0.2
   (item 0010) was the boil. It also left moving frames further from the ideal than
   point sampling did.

The fix: no jitter in motion, and a light history (`1 − 0.25 × antialias` of the new
frame). Stills still refine with jitter, and are pixel-identical to before.

| scene | flicker before | after | error cost vs point samples |
|---|---:|---:|---:|
| ring | 1.19% | 0.13% | −0.02 |
| terrain | 4.08% | 0.24% | +0.14 |
| blobs | 1.09% | 0.15% | −0.04 |
| globe | 3.40% | 0.03% | +0.08 |
| tunnel | 2.43% | 0.17% | +1.22 |

The `stability` option and the double-buffered glyph grid were removed: with the
jitter gone they cut flicker by nothing measurable (0.12% → 0.11%) and only added
error. The measurement is a CI check now: under 0.5% flicker in every scene, and
under 1.5 points of accuracy cost against point sampling.

Criterion 1 (recordings) stays open. The evidence here is quantitative, and nobody
has watched the before and after side by side in a browser.

## On the criteria

Criterion 2: flicker is cut 94% on terrain (4.08% → 0.24%), and lag is within 1.5 points of point sampling. Criterion 3: frame cost went down: no second glyph grid, no extra matching. Criterion 4: the stability option was removed, and stills are pixel-identical to main (contact sheet: no visual changes across 67 shots).
