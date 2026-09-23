# How rummy works

Notes on the pipeline, the choices behind it, and the prior art it builds on.

## The pipeline

Every frame is a handful of draws of a single fullscreen triangle (generated from
`gl_VertexID`, so there are no vertex buffers), and nothing is ever read back to the CPU.

### 1. Scene pass: `cols*2 × rows*3` (× quality)

The user's `scene(uv)` function runs once per *region*: each character cell is split into
a 2-wide, 3-tall grid, and the scene is sampled once per region. Output is RGBA8: colour
plus a 0..1 depth in alpha.

This is the main performance lever. The cost of a raymarched scene scales with the number
of fragments shaded. A 1920×1080 canvas at 2× DPR is ~8.3M pixels; at 12px text the grid
is roughly 275×72 cells, so ~119k samples. That is about 1.4% of the pixels, which is why
the built-in scenes can afford 64–90 raymarch steps and multi-octave noise and still
cost well under a millisecond on a laptop GPU.

**Temporal anti-aliasing.** One point sample per region aliases: a line thinner than a
region either hits the sample or vanishes. A still frame therefore samples at jittered
positions (an R2 low-discrepancy sequence) and averages 16 of them, which converges to
the quality of heavy supersampling for the cost of rendering it 16 times, once.
`quality: 2` remains for brute-force 2×2 supersampling.

In motion there is no jitter. The first version jittered in motion too, blending each
frame into an exponential history. Measuring glyph flicker (`pnpm measure`: cells that
flip and flip back within three frames) showed that jitter was the main source of
"boil". A sub-cell feature near a region boundary landed on alternate sides as the
sample moved, so glyphs like `.` and `` ` `` traded places every frame: 1–4% of cells
per frame, and frames further from the ideal than plain point sampling. Without jitter
in motion, flicker is 0.02–0.24%. A light history (`antialias` sets how much) halves
the flicker that remains in fast scenes while costing about one point of accuracy.
Glyph hysteresis was tried as well and removed: once the jitter was gone it no longer
reduced flicker, and it only added lag.

### 2. Exposure (only when adaptive)

For images and video (`exposure: 'source'`, the default) or `exposure: 'auto'`:

1. A cell-resolution pass writes each cell's mean luminance and mean square.
2. `generateMipmap` reduces that to one texel: the frame's mean and variance.
3. A 1×1 pass eases the stored exposure toward `0.85 / (mean + 2σ)`, so the bright end
   of the frame lands near full ink. It eases over ~0.5 s in motion, so cuts don't pump,
   and snaps when the frame is still.

The glyph pass reads the 1×1 texture directly. There is no GPU→CPU readback anywhere.

### 3. Glyph pass: `cols × rows`, two outputs

One fragment per character cell:

1. Fetch the six region samples and turn them into tone with exposure, `gain` and `gamma`.
2. **Two-tone** (`cellBackground`). The samples darker than the cell mean average into a
   "paper" colour that becomes the cell's background. Tone is then measured above it,
   so the glyph draws only what rises above the background, as in a real terminal's
   fg/bg pair.
3. **Directional contrast.** Each region is compared with the sample just outside the
   cell in that region's direction; if the outside is brighter, the region is darkened
   (`pow(s / max(s, e), k) * max(s, e)`). This separates adjacent shapes.
4. **Cell contrast.** Normalize the six values by their max, raise to `contrast`, scale
   back. This exaggerates the *shape* inside the cell without changing its peak.
5. **Silhouettes with direction.** If the depth range inside the cell exceeds
   `edgeThreshold`, the cell straddles an object boundary. A least-squares plane fit to
   the six depths gives the edge's direction. The midpoint between the near and far
   samples along that direction gives its position. The six tones are then replaced (by
   `edges`) with a synthetic stroke: ink that falls off with distance from that line. The
   glyph matcher then finds `/`, `\`, `|` or `_` because they *are* strokes at those
   angles and offsets.
6. **Match.** Brute-force nearest neighbour over every glyph's shape vector (squared
   Euclidean distance in 6D). With 95 glyphs that is ~190 texel fetches per cell.
   `mode: 'density'` compares only the mean, which reproduces a classic brightness ramp.
7. **Colour**, once per cell: `fg` mixed with the hue of the scene (`colorMix`). With a
   `palette`, the colour snaps to the nearest entry in OKLab after a 4×4 Bayer dither
   indexed by cell, so gradients dither across cells instead of banding.

Output: target 0 holds the glyph index and glyph colour, target 1 the cell background and
its alpha.

### 4. Glow: `cols × rows`, two passes

Each cell's light is its glyph colour times the glyph's mean ink coverage (already in the
shape vectors). A separable Gaussian blurs that over the cell grid: tens of thousands of
texels instead of millions of pixels. This is why a phosphor bloom costs about a tenth of
a millisecond. The composite samples the result bilinearly, so the halo is smooth even
though it was computed per cell.

### 5. Composite: full resolution

Per pixel: find the cell, fetch its glyph index and colours, fetch the atlas texel at the
same offset inside that glyph's slot, and blend over the background and glow. The atlas is
rendered at exact device-pixel cell size, so glyphs are pixel-crisp with no filtering. The
grid is anchored to the top-left so text never shifts when the canvas height changes.

The CRT stack lives here too, because this is the one pass that already touches every
pixel: barrel distortion of the lookup coordinate, aperture-grille mask, vignette, a
one-pixel red/blue offset of the atlas lookup for chromatic fringe, and flicker (never
under reduced motion).

## Measuring it

`profile: true` fills `stats.gpu` with per-pass milliseconds from
`EXT_disjoint_timer_query_webgl2`. The timer opens one query at the top of each frame and
closes it after one pass, rotating which pass, so every sample is "frame start → end of
pass X". A pass's own cost is the difference from the pass before it.

That design came out of a measurement. Timing each pass with its own back-to-back query
on Chrome with ANGLE on Metal produced running totals: each pass appeared to include
everything queued before it, apparently because submission is deferred. Cumulative
samples are correct on that backend and on ones with exact per-query timing alike.
Results are read back frames later and never waited on. Where the extension is missing,
`stats.gpu` stays `null` rather than reporting a CPU guess as GPU time.

`pnpm bench` runs every scene at 1080p and 1440p on the machine's real GPU in headless
Chrome and prints a table; `/bench.html` does the same in any browser.

## Seeing it

Visual work is judged by eye, so the repo makes looking cheap. `/shots.html` renders
every scene in every look, plus feature comparisons (edges off, antialiasing off,
`quality: 2`, two-tone blocks, auto-exposure on a dark source). Each shot is rendered
deterministically: fixed time, no pointer, fully refined. `scripts/shots.mjs` drives
that page headlessly with SwiftShader, writes PNGs and montages, and diffs against a
baseline. In CI it renders the pull request's base and head with the same driver and
posts the changes to the job summary, with side-by-sides in an artifact.

## The glyph atlas and shape vectors

At startup (and when the font, size, charset or DPR changes), every glyph is drawn white
on black into a 16-column 2D canvas, one cell per glyph, clipped to its cell. That canvas
is uploaded as an `R8` texture and also measured on the CPU: the ink coverage of each of
the six regions becomes the glyph's shape vector. Vectors are normalized so the inkiest
region across the whole charset equals 1.0, which puts them on the same scale as scene
tone.

Because the vectors come from the actual rendered font, any font and any charset work,
including box drawing, block elements and half-width katakana. Web fonts are handled by
waiting on `document.fonts.load()` and rebuilding once the face arrives.

## Background-friendly behaviour

- `IntersectionObserver` stops the loop entirely when the canvas is off screen.
- `prefers-reduced-motion` holds the scene's still (`#define STILL t` in its GLSL) and
  keeps it in sync with option changes. CRT flicker is off.
- A still frame refines for 16 frames, then the loop goes fully idle.
- `ResizeObserver` keeps the grid matched to layout without polling.
- `powerPreference: 'low-power'`, no depth/stencil/MSAA buffers.
- WebGL context loss is handled; everything is rebuilt on restore.
- A static source (an `<img>`) is uploaded once; videos and canvases are re-uploaded each
  frame with mipmaps so downsampling doesn't shimmer.

## Prior art and research

- **Alex Harri, [ASCII characters are not pixels](https://alexharri.com/blog/ascii-rendering)**
  (Jan 2026). The shape-vector approach: sample each cell in several regions, match
  against per-glyph vectors, and apply global and directional contrast enhancement. His
  renderer runs on the CPU with a k-d tree; rummy runs the same idea as brute force in a
  fragment shader, which the GPU handles easily at cell resolution.
- **Acerola, "I Tried Turning Games Into Text"** (2024). Difference-of-Gaussians plus a
  Sobel filter for edge direction, then directional glyphs for edges. Inspired many
  engine-side ASCII shaders, e.g. [this Minecraft port](https://modrinth.com/shader/ascii-like-shader).
  rummy uses scene depth for silhouettes instead, since it owns the scene.
- **three.js [`AsciiEffect`](https://threejs.org/examples/webgl_effects_ascii.html).** CPU
  readback into DOM text. Selectable text, but slow at hero sizes.
- **GPU post-process shaders**: [emilwidlund/ASCII](https://github.com/emilwidlund/ASCII),
  the [Codrops OGL tutorial](https://tympanus.net/codrops/2024/11/13/creating-an-ascii-shader-using-ogl/),
  [Efecto](https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders/),
  [webgl-ascii-hero](https://github.com/egorshest/webgl-ascii-hero). These render the
  scene at full resolution and map brightness per cell. Fine results, but they pay
  full-resolution shading and lose edge shape.

## Design constraints

- **Zero runtime dependencies.** A background effect should not pull a 3D engine into the
  bundle. Adapters for engines can live in separate entry points.
- **WebGL2 only.** It's universally available now, and `texelFetch`, integer ops,
  `gl_VertexID` and `R8`/`RGBA32F` textures keep the shaders simple.
- **Everything at the lowest resolution that is correct.** Shading at region resolution;
  matching, colour, exposure and glow at cell resolution; only the final glyph lookup
  and screen effects at pixel resolution.
- **No readbacks.** Every adaptive quantity (exposure, history, glow) stays on the GPU.
- **Shaders are minified at build time** (comments, whitespace) by a small Vite plugin.
  The source stays readable, and the demo build uses the same plugin, so the screenshot
  harness tests exactly what ships.
