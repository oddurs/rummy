/** Fullscreen triangle from gl_VertexID; no buffers needed. */
export const FULLSCREEN_VS = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * Scene pass prelude. User scenes define:
 *
 *   vec4 scene(vec2 uv)   // uv in 0..1 (y up) -> rgb + depth (0 near .. 1 far/empty)
 *
 * The pass runs at 2x3 samples per character cell (x quality), so a
 * 1920x1080 hero at 14px text is ~100k pixels of shading instead of 2M.
 */
export const SCENE_PRELUDE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform float uTime;
uniform vec2 uMouse;       // -1..1, y up, smoothed
uniform float uScroll;     // 0 at the top of the canvas .. 1 scrolled out, smoothed
uniform float uDetail;     // 1 = full detail; the frame-time governor lowers it on slow GPUs
uniform float uAspect;     // grid width / height
uniform vec2 uResolution;  // scene target size in samples
uniform vec2 uOffset;      // focal point shift in screen() units
uniform sampler2D uSource;
uniform vec2 uSourceScale;
uniform sampler2D uPrev;   // last frame's accumulated samples
uniform float uBlend;      // weight of this frame's sample (1 = no history)
uniform vec2 uJitter;      // sub-sample offset, in samples

in vec2 vUv;
out vec4 outColor;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

/** Centered, aspect-corrected coordinates: y in -1..1. */
vec2 screen(vec2 uv) { return (uv * 2.0 - 1.0) * vec2(uAspect, 1.0) - uOffset; }

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x),
                 mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x),
                 mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = rot(0.6) * p * 2.03; a *= 0.5; }
  return v;
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
`;

/**
 * Each frame samples at a jittered position inside the region and folds into
 * the running average, so thin features integrate over the region instead of
 * aliasing on a single point sample.
 */
export const SCENE_MAIN = /* glsl */ `
void main() {
  vec4 c = clamp(scene(vUv + uJitter / uResolution), 0.0, 1.0);
  if (uBlend < 1.0) c = mix(texelFetch(uPrev, ivec2(gl_FragCoord.xy), 0), c, uBlend);
  outColor = c;
}
`;

/** Built-in scene used when `scene` is an image, video or canvas. */
export const SOURCE_SCENE = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 s = (uv - 0.5) * uSourceScale + 0.5;
  return vec4(texture(uSource, vec2(s.x, 1.0 - s.y)).rgb, 0.5);
}
`;

/** Region fetch shared by the passes that read the scene target. */
const REGION = /* glsl */ `
uniform sampler2D uScene;
uniform int uQuality;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec4 region(ivec2 p) {
  ivec2 size = textureSize(uScene, 0) / uQuality;
  p = clamp(p, ivec2(0), size - 1) * uQuality;
  if (uQuality == 1) return texelFetch(uScene, p, 0);
  vec4 acc = vec4(0.0);
  for (int y = 0; y < uQuality; y++)
    for (int x = 0; x < uQuality; x++) acc += texelFetch(uScene, p + ivec2(x, y), 0);
  return acc / float(uQuality * uQuality);
}
`;

/** Per-cell luminance mean and mean square, mipmapped down to one texel. */
export const LUMA_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
${REGION}
out vec4 outColor;
void main() {
  ivec2 base = ivec2(gl_FragCoord.xy) * ivec2(2, 3);
  float m = 0.0, q = 0.0;
  for (int i = 0; i < 6; i++) {
    float l = luma(region(base + ivec2(i & 1, i >> 1)).rgb);
    m += l;
    q += l * l;
  }
  outColor = vec4(m / 6.0, q / 6.0, 0.0, 1.0);
}`;

/**
 * Exposure: a 1x1 target holding log2(exposure), eased toward a value that puts
 * the bright end of the frame (mean + 2 sigma) at 85% ink.
 */
export const EXPOSURE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uLuma;
uniform int uLumaLevel;
uniform sampler2D uPrevExposure;
uniform float uRate;
out vec4 outColor;
void main() {
  vec4 s = texelFetch(uLuma, ivec2(0), uLumaLevel);
  float m = s.x;
  float sd = sqrt(max(s.y - m * m, 0.0));
  float white = clamp(m + 2.0 * sd, 0.04, 1.0);
  float target = log2(clamp(0.85 / white, 0.5, 4.0));
  float prev = texelFetch(uPrevExposure, ivec2(0), 0).r * 3.0 - 1.0;
  outColor = vec4((mix(prev, target, uRate) + 1.0) / 3.0, 0.0, 0.0, 1.0);
}`;

/**
 * Glyph pass: one fragment per character cell.
 *
 *   out 0: r = glyph index / 255, gba = glyph colour
 *   out 1: rgb = cell background, a = background alpha
 *
 * Colour is resolved here, once per cell, so palettes and dithering cost
 * nothing per pixel.
 */
export const GLYPH_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
${REGION}
uniform sampler2D uShapes;
uniform sampler2D uExposureTex;
uniform int uAutoExposure;
uniform float uExposure;
uniform int uCount;
uniform int uMode;          // 0 = shape match, 1 = density ramp
uniform float uGain;
uniform float uGamma;
uniform float uContrast;    // within-cell contrast exponent
uniform float uDirContrast; // contrast against neighbouring cells
uniform float uEdges;       // silhouette strength 0..1
uniform float uEdgeThreshold;
uniform float uCellAspect;  // cell height / width
uniform float uStrokeInk;   // coverage of a line glyph, on the shape-vector scale
uniform vec3 uFg;
uniform vec4 uBg;
uniform float uColorMix;
uniform float uCellBg;      // two-tone strength 0..1
uniform vec3 uPalette[32];  // OKLab
uniform vec3 uPaletteRgb[32];
uniform int uPaletteSize;
uniform float uDither;     // amplitude, already scaled to the palette's spacing

layout(location = 0) out vec4 outGlyph;
layout(location = 1) out vec4 outCell;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

vec3 oklab(vec3 c) {
  c = toLinear(c);
  vec3 lms = mat3(0.4122214708, 0.2119034982, 0.0883024619,
                  0.5363325363, 0.6806995451, 0.2817188376,
                  0.0514459929, 0.1073969566, 0.6299787005) * c;
  lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));
  return mat3(0.2104542553, 1.9779984951, 0.0259040371,
              0.7936177850, -2.4285922050, 0.7827717662,
              -0.0040720468, 0.4505937099, -0.8086757660) * lms;
}

vec3 quantize(vec3 c, float dither) {
  if (uPaletteSize == 0) return c;
  vec3 lab = oklab(clamp(c + dither, 0.0, 1.0));
  int best = 0;
  float bd = 1e9;
  for (int i = 0; i < 32; i++) {
    if (i >= uPaletteSize) break;
    vec3 d = uPalette[i] - lab;
    float dist = dot(d, d);
    if (dist < bd) { bd = dist; best = i; }
  }
  return uPaletteRgb[best];
}

float glyphDistance(int k, vec4 a, vec2 b, float mean) {
  vec4 ka = texelFetch(uShapes, ivec2(k, 0), 0);
  vec4 kb = texelFetch(uShapes, ivec2(k, 1), 0);
  if (uMode == 1) return abs(kb.z - mean);
  vec4 da = ka - a;
  vec2 db = kb.xy - b;
  return dot(da, da) + dot(db, db);
}

float bayer4(ivec2 p) {
  int x = p.x & 3, y = p.y & 3;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[y * 4 + x]) + 0.5) / 16.0;
}

void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  ivec2 base = cell * ivec2(2, 3);
  float gain = uGain * (uAutoExposure == 1 ? exp2(texelFetch(uExposureTex, ivec2(0), 0).r * 3.0 - 1.0) : uExposure);

  float l[6];
  float d[6];
  float e[6];
  vec3 c[6];
  vec3 color = vec3(0.0);
  float dmin = 1.0, dmax = 0.0, lmean = 0.0;

  for (int i = 0; i < 6; i++) {
    int cx = i & 1;       // 0 left, 1 right
    int ry = i >> 1;      // 0 top .. 2 bottom
    ivec2 p = base + ivec2(cx, 2 - ry);
    vec4 v = region(p);
    c[i] = v.rgb;
    l[i] = clamp(luma(v.rgb) * gain, 0.0, 1.0);
    d[i] = v.a;
    color += v.rgb;
    lmean += l[i];
    dmin = min(dmin, v.a);
    dmax = max(dmax, v.a);
    // Outward neighbour: sideways for the middle row, diagonal for corners.
    ivec2 dir = ivec2(cx == 0 ? -1 : 1, ry == 0 ? 1 : (ry == 2 ? -1 : 0));
    e[i] = clamp(luma(region(p + dir).rgb) * gain, 0.0, 1.0);
  }
  color /= 6.0;
  lmean /= 6.0;

  // Two-tone: the darker samples become the cell's background; the glyph
  // draws whatever rises above it.
  float lb = 0.0;
  vec3 paper = vec3(0.0);
  if (uCellBg > 0.0) {
    float n = 0.0;
    for (int i = 0; i < 6; i++) if (l[i] <= lmean + 1e-4) { paper += c[i]; n += 1.0; }
    paper /= max(n, 1.0);
    lb = clamp(luma(paper) * gain, 0.0, 1.0) * uCellBg;
  }

  float s[6];
  for (int i = 0; i < 6; i++) {
    float t = max(l[i] - lb, 0.0) / max(1.0 - lb, 1e-3);
    s[i] = pow(t, uGamma);
    float te = max(e[i] - lb, 0.0) / max(1.0 - lb, 1e-3);
    e[i] = pow(te, uGamma);
  }

  // Directional contrast: darken regions that sit next to something brighter.
  if (uDirContrast != 1.0) {
    for (int i = 0; i < 6; i++) {
      float m = max(s[i], e[i]);
      if (m > 0.0) s[i] = pow(s[i] / m, uDirContrast) * m;
    }
  }

  // Global contrast inside the cell: sharpens the shape the glyph must match.
  float peak = max(max(max(s[0], s[1]), max(s[2], s[3])), max(s[4], s[5]));
  if (peak > 0.0 && uContrast != 1.0)
    for (int i = 0; i < 6; i++) s[i] = pow(s[i] / peak, uContrast) * peak;

  // Silhouettes: where the cell straddles a depth edge, draw a stroke along the
  // edge's actual direction and position, so outlines come out as / \\ | _ .
  float range = dmax - dmin;
  if (uEdges > 0.0 && range > uEdgeThreshold) {
    vec2 P[6];
    vec2 pm = vec2(0.0);
    float dm = 0.0;
    for (int i = 0; i < 6; i++) {
      P[i] = vec2((float(i & 1) + 0.5) * 0.5, (2.5 - float(i >> 1)) / 3.0 * uCellAspect);
      pm += P[i];
      dm += d[i];
    }
    pm /= 6.0;
    dm /= 6.0;
    vec2 g = vec2(0.0), gd = vec2(0.0);
    for (int i = 0; i < 6; i++) {
      vec2 q = P[i] - pm;
      g += (d[i] - dm) * q;
      gd += q * q;
    }
    g /= gd;
    vec2 n = length(g) > 1e-5 ? normalize(g) : vec2(0.0, 1.0);
    float mid = 0.5 * (dmin + dmax);
    float nearSum = 0.0, farSum = 0.0, nearN = 0.0, farN = 0.0;
    for (int i = 0; i < 6; i++) {
      float t = dot(P[i] - pm, n);
      if (d[i] < mid) { nearSum += t; nearN += 1.0; }
      else { farSum += t; farN += 1.0; }
    }
    // Where the edge sits along n: halfway between the near and far samples,
    // averaged with where the fitted plane crosses the depth midpoint. The
    // first is robust, the second uses the fractional coverage anti-aliased
    // samples carry; each alone doubles strokes or loses them on some slopes.
    float split = 0.5 * (nearSum / max(nearN, 1.0) + farSum / max(farN, 1.0));
    float fitted = length(g) > 1e-5 ? (mid - dm) / length(g) : split;
    float o = 0.5 * (split + fitted);
    // Strokes at the ink level of the font's own line glyphs: brighter targets
    // match heavier letters instead of / \ |.
    float ink = uStrokeInk;
    // Full replacement from edges = 0.5 up: a silhouette cell mixed with its
    // fill tone matches a heavier glyph than the stroke it should be.
    float k = smoothstep(0.0, 0.5, uEdges) * smoothstep(uEdgeThreshold, uEdgeThreshold * 2.0, range);
    // One cell per row draws a steep line (the one whose centre row it
    // crosses), one cell per column a shallow one. The owner draws a steep
    // stroke through its own centre, because / \ | are centred glyphs; a
    // shallow stroke keeps its height, because _ and - sit at different heights.
    // Neighbours clear their sliver of the line. Without this, a line near a
    // cell boundary splits into slivers that match : and ' or off-centre
    // strokes that match letters.
    bool steep = abs(n.x) >= abs(n.y);
    float at = steep ? o / n.x : o / n.y;
    float extent = steep ? 0.5 : 0.5 * uCellAspect;
    bool owner = abs(at) < extent;
    for (int i = 0; i < 6; i++) {
      float along = dot(P[i] - pm, n);
      if (owner) {
        float t = (steep ? along : along - o) / 0.32;
        s[i] = mix(s[i], ink * exp(-t * t), k);
      } else if (abs(along - o) < 0.45) {
        s[i] *= 1.0 - k;
      }
    }
  }

  vec4 a = vec4(s[0], s[1], s[2], s[3]);
  vec2 b = vec2(s[4], s[5]);
  float mean = (a.x + a.y + a.z + a.w + b.x + b.y) / 6.0;

  int best = 0;
  float bestDist = 1e9;
  for (int k = 0; k < uCount; k++) {
    float dist = glyphDistance(k, a, b, mean);
    if (dist < bestDist) { bestDist = dist; best = k; }
  }

  // Keep hue; lift dark cells so sparse glyphs still carry colour. When
  // quantizing, go all the way to full brightness: the glyph already carries
  // the tone, and a dim tint would snap to the palette's black and vanish.
  float cpeak = max(max(color.r, color.g), color.b);
  vec3 tint = color / max(cpeak, uPaletteSize > 0 ? 1e-3 : 0.25);
  float dither = (bayer4(cell) - 0.5) * uDither;  // uDither is pre-scaled to the palette's spacing
  vec3 fg = quantize(mix(uFg, tint, uColorMix), dither);

  vec3 bg = uBg.rgb;
  float bgA = uBg.a;
  if (uCellBg > 0.0) {
    float ppeak = max(max(paper.r, paper.g), paper.b);
    vec3 paperTint = mix(uFg, paper / max(ppeak, 0.25), uColorMix);
    float amount = clamp(lb, 0.0, 1.0);
    bg = quantize(mix(uBg.rgb, paperTint, amount), dither);
    bgA = mix(uBg.a, 1.0, amount);
  }

  outGlyph = vec4(float(best) / 255.0, fg);
  outCell = vec4(bg, bgA);
}`;

/**
 * Glow: separable Gaussian over the cell grid. The first pass turns each
 * cell into light (glyph colour x glyph ink coverage); both write
 * premultiplied colour in rgb and energy in a.
 */
export const GLOW_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uSource;
uniform sampler2D uShapes;
uniform int uFromGlyphs;
uniform ivec2 uDirection;
uniform float uRadius;      // in cells
out vec4 outColor;

vec4 light(ivec2 p) {
  ivec2 size = textureSize(uSource, 0);
  if (p.x < 0 || p.y < 0 || p.x >= size.x || p.y >= size.y) return vec4(0.0);
  vec4 g = texelFetch(uSource, p, 0);
  if (uFromGlyphs == 0) return g;
  int idx = int(g.r * 255.0 + 0.5);
  float ink = texelFetch(uShapes, ivec2(idx, 1), 0).z;
  return vec4(g.gba * ink, ink);
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float sigma = max(uRadius, 0.5) * 0.5;
  int r = int(min(ceil(uRadius), 8.0));
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = -8; i <= 8; i++) {
    if (i < -r || i > r) continue;
    float w = exp(-float(i * i) / (2.0 * sigma * sigma));
    acc += light(p + uDirection * i) * w;
    wsum += w;
  }
  outColor = acc / wsum;
}`;

/** Composite: full resolution. Glyph lookup, glow, and the CRT stack. */
export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uGlyphs;
uniform sampler2D uCells;
uniform sampler2D uGlowTex;
uniform sampler2D uAtlas;
uniform ivec2 uCell;       // device px
uniform ivec2 uGrid;       // columns, rows
uniform int uAtlasColumns;
uniform int uYOffset;      // anchors the grid to the top edge
uniform vec2 uResolution;  // canvas px
uniform float uGlow;
uniform float uScanlines;
uniform float uCurvature;
uniform float uVignette;
uniform float uMask;
uniform float uFringe;     // px
uniform float uFlicker;    // current gain multiplier, 1 = none

out vec4 outColor;

float inkAt(ivec2 p) {
  ivec2 cell = p / uCell;
  if (p.x < 0 || p.y < 0 || cell.x >= uGrid.x || cell.y >= uGrid.y) return 0.0;
  ivec2 local = p - cell * uCell;
  int idx = int(texelFetch(uGlyphs, cell, 0).r * 255.0 + 0.5);
  ivec2 at = ivec2(idx % uAtlasColumns, idx / uAtlasColumns) * uCell
           + ivec2(local.x, uCell.y - 1 - local.y);
  return texelFetch(uAtlas, at, 0).r;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uResolution * 2.0 - 1.0;
  float outside = 0.0;
  if (uCurvature > 0.0) {
    vec2 k = uv * (1.0 + uCurvature * 0.12 * dot(uv, uv));
    outside = step(1.0, max(abs(k.x), abs(k.y)));
    frag = (k * 0.5 + 0.5) * uResolution;
  }

  ivec2 p = ivec2(floor(frag)) + ivec2(0, uYOffset);
  ivec2 cell = clamp(p / uCell, ivec2(0), uGrid - 1);
  vec4 g = texelFetch(uGlyphs, cell, 0);
  vec4 bgc = texelFetch(uCells, cell, 0);

  vec3 ink;
  if (uFringe > 0.0) {
    int f = int(uFringe + 0.5);
    ink = vec3(inkAt(p + ivec2(f, 0)), inkAt(p), inkAt(p - ivec2(f, 0)));
  } else {
    ink = vec3(inkAt(p));
  }

  // Background, premultiplied, with glow laid over it.
  vec3 base = bgc.rgb * bgc.a;
  float alpha = bgc.a;
  if (uGlow > 0.0) {
    vec2 cuv = (vec2(p) + 0.5) / vec2(uCell) / vec2(uGrid);
    vec4 gl = texture(uGlowTex, cuv);
    float amount = clamp(gl.a * uGlow, 0.0, 1.0);
    vec3 glowColor = gl.a > 1e-4 ? gl.rgb / gl.a : vec3(0.0);
    base = mix(base, glowColor, amount);
    alpha = mix(alpha, 1.0, amount);
  }

  vec3 rgb = mix(base, g.gba, ink);
  alpha = mix(alpha, 1.0, max(ink.r, max(ink.g, ink.b)));

  if (uScanlines > 0.0) rgb *= 1.0 - uScanlines * float((int(gl_FragCoord.y) & 1) == 0);
  if (uMask > 0.0) {
    int col = int(gl_FragCoord.x) % 3;
    vec3 m = col == 0 ? vec3(1.0, 0.0, 0.0) : (col == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
    rgb *= mix(vec3(1.0), 0.35 + 0.95 * m, uMask);
  }
  if (uVignette > 0.0) {
    float v = 1.0 - uVignette * 0.6 * pow(dot(uv * vec2(0.85, 1.0), uv * vec2(0.85, 1.0)) * 0.5, 1.4);
    rgb *= clamp(v, 0.0, 1.0);
  }
  rgb *= uFlicker;
  outColor = vec4(rgb, alpha) * (1.0 - outside);
}`;

/**
 * Transition: mixes a frozen "from" glyph grid with the live "to" grid, per
 * cell. Each cell switches at its own moment (by style), passing through a
 * short scramble of random glyphs on the way. Also used, with style 4, to
 * copy a grid.
 */
export const MIX_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uFromGlyphs;
uniform sampler2D uFromCells;
uniform sampler2D uToGlyphs;
uniform sampler2D uToCells;
uniform float uProgress;   // 0..1
uniform int uStyle;        // 0 decode, 1 wipe, 2 rain, 3 dissolve, 4 copy "to"
uniform float uTick;       // changes ~20 times a second, reseeding the scramble
uniform int uCount;
uniform ivec2 uGrid;
layout(location = 0) out vec4 outGlyph;
layout(location = 1) out vec4 outCell;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  vec4 g1 = texelFetch(uToGlyphs, cell, 0);
  vec4 c1 = texelFetch(uToCells, cell, 0);
  if (uStyle == 4) {
    outGlyph = g1;
    outCell = c1;
    return;
  }
  vec4 g0 = texelFetch(uFromGlyphs, cell, 0);
  vec4 c0 = texelFetch(uFromCells, cell, 0);

  // When this cell switches (t) and how long it scrambles first (band).
  float r = hash(vec2(cell));
  float t, band;
  if (uStyle == 0) {          // decode: cells resolve in random order
    t = r * 0.75;
    band = 0.25;
  } else if (uStyle == 1) {   // wipe: a scrambling edge sweeps left to right
    t = float(cell.x) / float(uGrid.x) * 0.85 + r * 0.03;
    band = 0.12;
  } else if (uStyle == 2) {   // rain: each column falls from the top at its own time
    float down = 1.0 - (float(cell.y) + 0.5) / float(uGrid.y);
    t = hash(vec2(float(cell.x), 7.0)) * 0.45 + down * 0.47;
    band = 0.08;
  } else {                    // dissolve: no scramble, for reduced motion
    t = r * 0.95;
    band = 0.0;
  }
  float p = uProgress * (1.0 + band);

  bool empty = g0.r < 0.5 / 255.0 && g1.r < 0.5 / 255.0;
  if (p < t) {
    outGlyph = g0;
    outCell = c0;
  } else if (p < t + band && !empty) {
    int idx = 1 + int(floor(hash(vec2(cell) + uTick * 1.618) * float(uCount - 1)));
    vec3 lit = min(max(g1.gba, g0.gba) * 1.35 + 0.08, vec3(1.0));
    outGlyph = vec4(float(idx) / 255.0, lit);
    outCell = c1;
  } else {
    outGlyph = g1;
    outCell = c1;
  }
}`;
