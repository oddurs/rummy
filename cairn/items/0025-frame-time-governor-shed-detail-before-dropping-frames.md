---
id: 25
title: 'Frame-time governor: shed detail before dropping frames'
type: perf
status: review
milestone: v0.3
assignee: Oddur Sigurdsson
claimed: 2026-09-23
depends_on:
- 8
created: 2026-09-22
updated: 2026-09-23
priority: p1
pillar: speed
area: engine
effort: m
---

## Where the time goes

Scenes are designed on fast machines. On a weak phone GPU, a 100-step
raymarch at 3× DPR can miss the frame budget, and a background that stutters is
worse than a simpler one that doesn't.

## Proposal

A governor watching GPU time (from `stats.gpu`) or frame time, stepping down in
order until the frame fits, and back up with hysteresis:

1. `uDetail` 1 → 0.5 (a uniform scenes use to scale step counts and octaves;
   built-ins honour it)
2. cap DPR for the scene pass only (text stays crisp; the scene gets coarser)
3. frame rate 60 → 30

Exposed as `adaptive: true` (default) and `stats.level`.

## Before → after

| | before | after |
|---|---|---|
| worst scene, mid Android | unknown | holds 60 or steps down cleanly |

## Acceptance criteria

- [x] Built-in scenes honour `uDetail`
- [x] No oscillation between levels
- [ ] Measured on at least one low-end device

## Built, and what the measurements changed

`adaptive: true` (default), with `stats.level` (0 = full detail) and a `uDetail`
uniform that the built-in scenes use to scale raymarch steps (and terrain octaves).

**The levers were chosen by measuring them, not by the proposal.** Under a genuinely
slow load (SwiftShader, terrain, 1280×720, 8px, 2× supersampling):

| lever | fps |
|---|---:|
| baseline | 21.6 |
| scene detail 0.35 | 22.3 (almost nothing) |
| 2× → 1× supersampling | 50.8 |
| + glow off | 56.3 |

Scene detail barely moves the built-ins, because their raymarch isn't where the time
goes. It stays in the chain for heavy custom scenes. The proposal's "cap DPR for the
scene pass" was dropped: it would change sampling, and supersampling is the real cost.
Order: (1) 1× sampling + detail 0.6, (2) detail 0.35 + no glow, (3) 30 fps cap, last
because it is the most visible.

The governor learns the display period from the fastest frames (drifting up 0.1% per
frame, so slow frames never become the norm). Frames count as late at 1.3× the
target. A second of late frames steps down; 4 s on time probes a level up; a probe
that fails within 2 s doubles the wait (up to 60 s).

Checked by `pnpm measure` (in CI), in real time on SwiftShader, which escalates the
load until the governor-off baseline is under 30 fps:
- **Best run:** page 11 → **60 fps** (rummy steady at its 30 fps cap).
- **With supersampling already off:** page 22 → 31 fps (+41%).
- Levels only go down under load (no flapping), come back up once the canvas is
  cheap, and `adaptive: false` stays at full detail.

Criterion 3 asks for a real low-end device. SwiftShader (software rendering) is the
stand-in until someone runs it on one.

## Also

Two things came up while finishing:
- The GPU profiler (src/timer.ts) is now a lazily loaded chunk (0.81 KB gzipped), imported on first use of `profile: true`. That took the core from 14.00 to 13.50 KB, where the governor had pushed it to the limit.
- The contact sheet caught the governor making shots nondeterministic: during a transition the shot page's renderer counts as moving, its frame loop ran between shots, and the level changed. Shots now run with `adaptive: false`.

## Test hardened after CI

The first CI run failed the responsiveness check. CI's SwiftShader is several times slower, so the test load was far past the machine's limit, where no level can help (page 8 → 10 fps). The test now looks for the *smallest* slow load (2× sampling, growing the canvas) with a 2 s warm-up, so it measures the governor where one has to work, on any machine. Local, three runs: page 25→39, 10→40, 20→57 fps.

## Probing is not flapping

The next CI run went 0→1→2→3, probed up to 2 after 4 s on time, found it late and returned to 3: 5 changes. That's the designed probe. The check now allows one failed probe in the ~9 s window (the wait doubles after each), and anything more fails as flapping.
