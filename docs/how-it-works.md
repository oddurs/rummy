# How rummy works

Notes on the pipeline, the choices behind it, and the prior art it builds on.

## The pipeline

Every frame is three draws of a single fullscreen triangle (generated from `gl_VertexID`,
so there are no vertex buffers).

### 1. Scene pass: `cols*2 × rows*3` (× quality)

The user's `scene(uv)` function runs once per *region*: each character cell is split into
a 2-wide, 3-tall grid, and the scene is sampled at the centre of each region. Output is
RGBA8: colour plus a 0..1 depth in alpha.

This is the main performance lever. The cost of a raymarched scene scales with the number
of fragments shaded. A 1920×1080 canvas at 2× DPR is ~8.3M pixels; at 12px text the grid
is roughly 275×72 cells, so ~119k samples. That is about 1.4% of the pixels, which is why
the built-in scenes can afford 90–100 raymarch steps and multi-octave noise and still
idle on an integrated GPU.

`quality: 2` renders 2×2 samples per region and averages them, for smoother motion on
thin features.

### 2. Glyph pass: `cols × rows`

One fragment per character cell:

1. Fetch the six region samples and convert to a tone value with `gain` and `gamma`.
2. **Depth silhouettes.** If the depth range inside the cell exceeds `edgeThreshold`, the
   cell straddles an object boundary. Near samples are pushed toward full ink and far
   samples toward none, which makes the outline read as a crisp stroke (`_`, `/`, `j`,
   `L`) instead of a smear.
3. **Directional contrast.** For each region, compare it to the sample just outside the
   cell in that region's direction. If the outside is brighter, the region is darkened
   (`pow(s / max(s, e), k) * max(s, e)`). This separates adjacent shapes.
4. **Cell contrast.** Normalize the six values by their max, raise to `contrast`, scale
   back. This exaggerates the *shape* inside the cell without changing its peak.
5. **Match.** Brute-force nearest neighbour over every glyph's shape vector (squared
   Euclidean distance in 6D). With 95 glyphs that is ~190 texel fetches per cell, which
   is negligible at cell resolution. `mode: 'density'` compares only the mean, which
   reproduces a classic brightness ramp.

Output is RGBA8: glyph index in R, a hue-preserving cell colour in GBA.

### 3. Composite pass: full resolution

Per pixel: find the cell, fetch its glyph index and colour, fetch the atlas texel at the
same offset inside that glyph's slot, and blend `fg` over `bg`. The atlas is rendered at
exact device-pixel cell size, so glyphs are pixel-crisp with no filtering. The grid is
anchored to the top-left so text never shifts when the canvas height changes.

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
- `prefers-reduced-motion` renders a still frame and keeps it in sync with option changes.
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
- **Everything at the lowest resolution that is correct.** Shading at region resolution,
  matching at cell resolution, only the final glyph lookup at pixel resolution.
