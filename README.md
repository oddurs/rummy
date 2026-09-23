# rummy

**Real-time 3D scenes rendered as ASCII, in WebGL2. Built for hero backgrounds.**

![A twisted torus rendered in coloured ASCII characters](docs/img/ring.png)

rummy takes a raymarched scene, a video or any canvas and draws it as live text, like a
terminal with a GPU in it. It is small (one ES module, zero dependencies) and cheap: it
shades one sample per *character region*, not per pixel, so a full-screen hero costs about
as much as a thumbnail.

**[Live demo →](https://oddurs.github.io/rummy/)** (drag an image or video onto it)

| | |
|---|---|
| ![Terrain flyover under a striped sun, amber](docs/img/terrain.png) | ![Rotating wireframe globe, green phosphor](docs/img/globe.png) |

## Why another ASCII shader

Most ASCII effects render the scene at full resolution, then post-process every pixel into
a brightness ramp (` .:-=+*#%@`). That wastes nearly all the shading work and throws away
shape: a diagonal edge and a flat grey patch become the same character.

rummy does two things differently:

1. **It renders the scene at cell resolution.** Each character cell gets 2×3 samples.
   At 1440×900 with 12px text that is ~68k samples instead of ~1.2M pixels, **about 6%
   of the shading cost**. Your scene can afford 100-step raymarches and 5-octave noise.
2. **It picks glyphs by shape, not just brightness.** Every glyph in the font is measured
   once into a 6D "shape vector" (ink coverage in each 2×3 region). Each cell picks the
   glyph whose shape best matches its six samples, so edges come out as `/`, `_`, `|`, `(`
   and silhouettes look drawn rather than dithered. This is the technique from
   [Alex Harri's deep dive](https://alexharri.com/blog/ascii-rendering), run on the GPU.

Then it adds depth-aware silhouettes, contrast enhancement against neighbouring cells, any
charset (ASCII, box drawing, blocks, katakana), any font, and the boring things a
background needs: pausing off screen, `prefers-reduced-motion`, DPR caps, context-loss
recovery.

## Quick start

```sh
pnpm add @oddurs/rummy   # not yet published; see "Status" below
```

```html
<canvas id="hero" style="position:absolute; inset:0; width:100%; height:100%"></canvas>
```

```ts
import { Rummy, scenes } from '@oddurs/rummy';

const rummy = new Rummy(document.querySelector('#hero')!, {
  scene: scenes.terrain,
  fg: '#ffb000',
  bg: '#0b0700',
  fontSize: 12,
});

rummy.set({ edges: 0.8 }); // change anything live
rummy.destroy();           // clean up on unmount
```

### Asciify a video, image or canvas

```ts
const video = document.querySelector('video')!;
new Rummy(canvas, { scene: video, colorMix: 1 });
```

Anything that is a `TexImageSource` works: `<video>`, `<img>`, `<canvas>`, `ImageBitmap`,
`VideoFrame`. That includes a three.js or Babylon canvas, so any existing 3D scene can be
fed in today (see [the roadmap](#roadmap) for a zero-copy path).

### Write your own scene

A scene is a GLSL function that returns a colour and a depth for a point on screen:

```ts
const pulse = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 p = screen(uv);                       // centred, aspect-correct, y in -1..1
  float r = length(p - uMouse * 0.5);
  float ring = smoothstep(0.05, 0.0, abs(r - 0.5 - 0.1 * sin(uTime * 2.0)));
  return vec4(vec3(ring), r);                // rgb, depth (0 near .. 1 far)
}`;

new Rummy(canvas, { scene: pulse });
```

Available in scenes: `uTime`, `uMouse` (−1..1, smoothed), `uAspect`, `uResolution`,
`uOffset`, and helpers `screen()`, `rot()`, `hash12()`, `hash13()`, `noise()`, `fbm()`
(2D and 3D). Depth only matters for the `edges` silhouette effect; return a constant if
you don't care.

Built-in scenes: `ring`, `terrain`, `blobs`, `globe`, `tunnel`.

## Options

All options are optional and can be changed later with `rummy.set()`.

| Option | Default | |
|---|---|---|
| `scene` | `scenes.ring` | GLSL string or `TexImageSource` |
| `fontSize` | `12` | CSS px |
| `fontFamily` | JetBrains Mono → system mono | Any loaded font; the atlas rebuilds when a web font arrives |
| `fontWeight` | `500` | |
| `lineHeight` | `1.25` | Cell height as a multiple of `fontSize` |
| `charset` | `charsets.ascii` | Any string; see `charsets` for presets |
| `mode` | `'shape'` | `'shape'` matches glyph silhouettes, `'density'` is a classic ramp |
| `fg` / `bg` | `#9dffb0` / `#050805` | Any CSS colour; `bg: 'transparent'` to layer over content |
| `colorMix` | `0` | 0 = monochrome `fg`, 1 = scene colour |
| `gain` / `gamma` | `0.85` / `1.15` | Tone curve before glyph matching |
| `contrast` | `1.6` | Sharpens shape inside a cell (1 = off) |
| `directionalContrast` | `2` | Sharpens against neighbouring cells (1 = off) |
| `edges` | `0.5` | Depth-silhouette strength, 0..1 |
| `quality` | `1` | `2` supersamples each region 2×2 |
| `offset` | `[0, 0]` | Shift the focal point, e.g. to sit beside your headline |
| `scanlines` | `0` | Darken alternate pixel rows |
| `maxFps` | `0` | Cap frame rate (0 = display rate) |
| `maxDpr` | `2` | Device pixel ratio cap |
| `timeScale` | `1` | |
| `mouse` | `true` | Feed the pointer to `uMouse` |
| `pauseOffscreen` | `true` | Stop when scrolled out of view |
| `respectReducedMotion` | `true` | Render a still frame under `prefers-reduced-motion` |

Methods: `set(options)`, `play()`, `pause()`, `render()`, `destroy()`.
Read-only: `stats` (`columns`, `rows`, `samples`, `width`, `height`, `fps`), `options`.

## How it works

```
 scene pass            glyph pass               composite pass
 cols*2 x rows*3  ──►  cols x rows         ──►  full resolution
 your GLSL,            6 samples → contrast     cell → glyph index →
 rgb + depth           → nearest shape vector   atlas texel → colour
```

Three fullscreen-triangle draws, no vertex buffers, no readbacks. The composite pass is
two `texelFetch`es per pixel. Details, prior art and design notes are in
[docs/how-it-works.md](docs/how-it-works.md).

## Status

Early (v0.1). The engine, five scenes and the demo work; the API may still change before
1.0. Not yet on npm.

## Roadmap

- [ ] Publish to npm
- [ ] three.js / R3F adapter that shares the WebGL context (no canvas copy)
- [ ] Phosphor persistence: cheap per-cell trails at cell resolution
- [ ] Per-cell glyph animation (decode/"matrix rain" transitions between frames)
- [ ] More scenes, plus a scene gallery
- [ ] WebGPU backend
- [ ] Screen-reader-friendly text mode (render to real DOM text for small grids)

## Development

```sh
pnpm install
pnpm dev          # demo at http://localhost:5173
pnpm check        # typecheck + library build + demo build
```

`src/` is the library, `demo/` is the site deployed to GitHub Pages.

## License

[MIT](LICENSE)
