---
id: 7
title: Screenshot every scene in every palette on every change
type: feature
status: shipped
milestone: v0.2
created: 2026-09-22
updated: 2026-09-23
priority: p0
pillar: craft
area: infra
effort: m
---

## Problem

Every item in this milestone is judged by eye, and today looking means opening
the demo and clicking through five scenes and five palettes by hand. Nobody
does that for every change, so regressions in one scene hide behind
improvements in another. The first commit already showed it: the tone curve
that fixed `ring` was only checked on two scenes.

## Proposal

A `pnpm shots` script that drives headless Chrome (SwiftShader, so it runs in
CI with no GPU) through `demo/#ui=0&paused=1&...` for every scene × palette ×
{mode shape, density}, at a fixed `uTime`, and writes:

- one PNG per combination under `shots/`
- a contact sheet (`shots/index.html`) with everything on one page
- a diff against the goldens on `main`, with a percentage per image

CI uploads the contact sheet as an artifact on every PR and comments the
biggest diffs. Goldens update only by an explicit `pnpm shots --update`.

Paused rendering must be deterministic for this to work: fixed time, fixed
mouse, no dependence on frame timing. Add `?t=` to the demo to pin time.

## Cost

Nothing at runtime. CI time: roughly a minute with SwiftShader.

## Acceptance criteria

- [x] `pnpm shots` renders every scene × palette × mode deterministically
- [x] Two runs on the same commit produce identical images
- [x] CI posts the contact sheet on every PR
- [x] A deliberately broken shader fails CI with the image that broke

## Built in 0.2

`demo/shots.html` renders every scene in every look (7 looks), plus feature
comparisons: density mode, edges off, antialias off, `quality: 2`, two-tone blocks,
box-drawing charset, auto-exposure on and off against a dark source, and every scene at
hero size and at 16px. 54 shots in about 8 s with SwiftShader.

`scripts/shots.mjs` drives it over the DevTools protocol with Node's built-in
WebSocket, so it has no npm dependencies. Flags: `--compare`, `--save-baseline`,
`--twice` (determinism), `--sheet` (one montage per scene). Each still is rendered at
the scene's `#define STILL` time with no pointer and 17 refinement frames.

- Determinism: `--twice` passes on all 54 shots.
- Failure: a deliberate syntax error in `tunnel` fails the run (exit 1), naming the
  shot and printing the compiler log.
- CI: the `shots` job renders the base commit and the head with the same driver, diffs
  them, writes the table to the job summary and uploads everything as the `shots`
  artifact. Committed goldens were rejected: font rasterization differs across
  platforms, so goldens would only ever match the machine that made them.

Criterion 3 stays open until the job has run on a real pull request.

## First CI run

PR #1: the shots job rendered all 54 shots on ubuntu-latest in 30.6 s, wrote the summary and uploaded the sheet as the `shots` artifact. The base (main) had no contact sheet yet, so the base-vs-head diff path first runs on the next PR; that path has only been exercised locally (`--compare shots/baseline`).

## Closed out in PR #4

The base-vs-head path ran for the first time on PR #4: base (main) rendered 54 shots and head 67, and 55 of 67 differed, as intended for a PR that changes silhouettes and dithering. Every criterion has now been exercised in CI.
