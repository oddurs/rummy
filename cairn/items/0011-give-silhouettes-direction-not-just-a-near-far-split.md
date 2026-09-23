---
id: 11
title: Give silhouettes direction, not just a near/far split
type: look
status: shipped
milestone: v0.2
depends_on:
- 7
created: 2026-09-22
updated: 2026-09-23
priority: p1
pillar: look
area: engine
effort: m
budget: <= +0.1 ms GPU at 1080p
---

## Now

When a cell straddles a depth edge, samples nearer than the midpoint get
pushed to full ink and the rest to none. Shape matching then picks a glyph.
Outlines come out well on big curves (`_jgg`, `7P`) but go soft on diagonals,
and creases *within* an object (the ring's twisted square edges) get nothing
because their depth barely changes.

## Target

Contour lines like a pen drawing: `/` and `\` on diagonals, `|` on verticals,
`_` and `‾` top and bottom, with interior creases drawn as well as silhouettes.

## Approach

- Estimate the depth gradient from the six samples plus neighbours, and use its
  direction to build a synthetic edge-shaped target vector (ink along the edge
  line) instead of the near/far split.
- Let scenes optionally return a normal (a second render target, or pack it
  with depth), so creases can be found from normal discontinuities, as in
  Acerola's approach. Scenes that do not provide normals keep today's path.
- Blend the edge target with the tone target by `edges`.

## How we judge it

`ring` (creases), `blobs` (soft silhouettes), `globe` (limb). Compare against
line art, not against today's output.

## Acceptance criteria

- [x] Before/after screenshots attached to the PR
- [x] Frame cost within `budget`
- [x] Diagonal silhouettes resolve to `/` and `\` more often than to letters
- [x] Scenes without normals look no worse than today

## Built in 0.2

Replaced the near/far split with a **stroke along the fitted edge**:

- A least-squares plane fit to the six depths (separable on the regular 2×3 grid) gives
  the edge direction.
- The midpoint between the near and far samples along it gives the edge position.
- The target becomes a Gaussian ridge along that line, blended by `edges` and by how
  decisively the cell straddles the edge.

The glyph matcher does the rest: `/ \ | _` win because they are strokes at those angles.

Evidence: `ring-phosphor` vs `ring-no-edges` on the contact sheet. With edges, the
outline draws as a continuous line of `/ \ | ( J L _`. Without, it is dots and
fragments. Bench: edges 0.6 vs 0 totals within noise.

**Not done from the proposal:** scene-supplied normals for interior creases. No
scene outputs normals, and the extra render target wasn't worth it before the depth-only
version was judged. Criterion 3 is left for a human: diagonals come out as `/` and `\`
often, but corners still pick letters (`J`, `L`, `7`), and "more often than letters"
wants counting or a careful look, not an assertion from me.

## Before/after

Side-by-side is in PR #1's `shots` artifact (the with/without comparison shots).

## Closed out in PR #4

Measured, and the measurement showed the 0.2 version didn't work. `pnpm measure`
renders flat test shapes and counts the glyphs on their outlines via the new
`toText()`:

| shape | before | after |
|---|---|---|
| spike (edges at the angle `/` draws) | 2% `/ \`, 64% letters | 98% `/ \`, 0% letters |
| diamond (45°) | 3% `/ \`, 35% letters | 19% `/ \`, 41% `- _ \|`, 0% letters |

Four causes, four fixes:
1. **Magnitude:** shape vectors are normalized to the inkiest region in the charset,
   and a thin `/` sits around 0.4. A stroke target near 0.8 matched heavier
   letters. Strokes now use the font's measured line-glyph ink (`atlas.strokeInk`).
2. **Ownership:** a line near a cell boundary split into two slivers (`:` and `'`)
   or an off-centre stroke (`I`, `Z`). One cell per row or column now owns it, and
   neighbours clear their sliver.
3. **Centring:** steep strokes snap to the owner's centre, since `/ \ |` are
   centred glyphs; shallow strokes keep their height.
4. **Mixing:** at `edges: 0.6`, 40% of the fill tone remained and pulled toward
   letters. Owners now fully replace it from `edges: 0.5`.

A 45° line in a 2:1 cell is drawn as runs like `/-/` and `\-\`, not a column of
slashes. The original criterion assumed slashes; the test now expects "strokes
and punctuation, not letters" for 45° and "mostly slashes" at the slash's own
angle.

**Known imperfection:** at exactly the slash angle, outlines are sometimes two
cells wide (`//`), because both cells claim the line. It reads as a bold stroke.
Fixing it cleanly needs neighbour information in the glyph pass.

Before/after: the `diamond-*` and `spike-*` pairs and `ring-no-edges` in PR #4's
`shots` artifact.
