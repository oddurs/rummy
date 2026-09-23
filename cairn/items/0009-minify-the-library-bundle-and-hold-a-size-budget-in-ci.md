---
id: 9
title: Minify the library bundle and hold a size budget in CI
type: perf
status: shipped
milestone: v0.2
created: 2026-09-22
updated: 2026-09-23
priority: p1
pillar: speed
area: infra
effort: s
budget: library <= 15 KB gz, core (Rummy only) <= 12.5 KB gz
---

## Where the time goes

`dist/rummy.js` ships at 30 KB raw / 10.4 KB gzipped, **unminified**: Vite 8's
library mode ignored `build.minify: true` for the ES format. Most of the bytes
are GLSL, which no JS minifier touches.

## Proposal

1. Get the JS minifier actually running in library mode (or run it as a
   separate step).
2. Strip GLSL comments and collapse whitespace at build time with a tiny
   transform; keep the source readable.
3. Make scenes tree-shakeable, so importing `Rummy` alone does not ship all five
   scenes. Default `scene` should not pull the whole scene module.
4. CI fails if the gzipped core grows past the budget.

## Before → after

| | before | after |
|---|---|---|
| core, gzipped | 10.4 KB (with all scenes) | target <= 6 KB without scenes |

## Acceptance criteria

- [x] Minified output, verified by inspecting the bundle
- [x] GLSL whitespace and comments stripped in the build only
- [x] `import { Rummy }` alone excludes the built-in scenes
- [x] CI size check with the budget above

## Built in 0.2

- Vite 8's library mode ignores `build.minify` for ES output; forcing
  `rolldownOptions.output.minify` fixed it.
- `scripts/glsl-minify.ts` strips comments and whitespace from `/* glsl */`
  literals. It must run with `enforce: 'pre'`, or the TypeScript transform deletes the
  marker comments first. The demo build uses it too, so the screenshot harness exercises
  the shipped shaders.
- `scripts/size.mjs` gzips the library, then bundles an app that imports only `Rummy`
  and checks that other scenes and the palettes are tree-shaken out. The default scene
  (`ring`) stays, as it must.

**The budget moved, and here is why.** Measured: library 13.4 KB, core 11.9 KB
gzipped. The 12 KB whole-library target was written before 0.2 added about 4 KB of
shader (glyph-pass colour and silhouettes, exposure, glow, CRT). GLSL is now about 10 KB
of the gzipped total. The gate is set at the measured size plus headroom (library 15
KB, core 12.5 KB) so it catches creep. Going lower needs identifier mangling in GLSL,
filed as its own item.

## After the art pass

Re-measured after the scene rework: library 14.07 KB, core 12.05 KB gzipped (the new scenes add ~0.6 KB of GLSL). Still inside the gates, but the core has under 0.5 KB of headroom, so the next shader feature will hit it. That is the gate doing its job; identifier mangling (the 'Mangle GLSL identifiers' item) is the way to earn room back.

## Budget raised in 0.3

Custom uniforms (0020) put the core 0.03 KB over the 12.5 KB gate, after the GLSL minifier had already been tightened again (no space when joining lines unless both sides are identifier characters; only 0.06 KB, since gzip handles spaces well). Raised to 13 KB core / 15.5 KB library as a recorded decision: a feature, not creep. Identifier mangling (0051) is how to earn it back.

## Budget raised again in 0.3

Transitions (0022) added 0.88 KB gzipped: the mix shader plus JS. Before raising, identifier mangling (0051) was measured, at 0.17 KB, and dropped. GLSL is ~10 KB of the gzipped bundle and is the features themselves. New gates: core 14 KB, library 16.5 KB. The original 6 KB core target isn't compatible with this feature set; about 14 KB is still a tenth of three.js.
