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
uniform float uAspect;     // grid width / height
uniform vec2 uResolution;  // scene target size in samples
uniform vec2 uOffset;      // focal point shift in screen() units
uniform sampler2D uSource;
uniform vec2 uSourceScale;

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

export const SCENE_MAIN = /* glsl */ `
void main() { outColor = clamp(scene(vUv), 0.0, 1.0); }
`;

/** Built-in scene used when `scene` is an image, video or canvas. */
export const SOURCE_SCENE = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 s = (uv - 0.5) * uSourceScale + 0.5;
  return vec4(texture(uSource, vec2(s.x, 1.0 - s.y)).rgb, 0.5);
}
`;

/**
 * Glyph pass: one fragment per character cell.
 * Reads the 2x3 scene samples, enhances contrast, picks the nearest glyph.
 * Output: r = glyph index / 255, gba = cell color.
 */
export const GLYPH_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uScene;
uniform sampler2D uShapes;
uniform int uCount;
uniform int uQuality;
uniform int uMode;          // 0 = shape match, 1 = density ramp
uniform float uGain;
uniform float uGamma;
uniform float uContrast;    // within-cell contrast exponent
uniform float uDirContrast; // contrast against neighbouring cells
uniform float uEdges;       // depth-silhouette strength 0..1
uniform float uEdgeThreshold;

out vec4 outColor;

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

float level(vec3 c) { return pow(clamp(luma(c) * uGain, 0.0, 1.0), uGamma); }

void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  ivec2 base = cell * ivec2(2, 3);
  float s[6];
  float e[6];
  float d[6];
  vec3 color = vec3(0.0);
  float dmin = 1.0, dmax = 0.0;

  for (int i = 0; i < 6; i++) {
    int cx = i & 1;       // 0 left, 1 right
    int ry = i >> 1;      // 0 top .. 2 bottom
    ivec2 p = base + ivec2(cx, 2 - ry);
    vec4 v = region(p);
    s[i] = level(v.rgb);
    d[i] = v.a;
    color += v.rgb;
    dmin = min(dmin, v.a);
    dmax = max(dmax, v.a);
    // Outward neighbour: sideways for the middle row, diagonal for corners.
    ivec2 dir = ivec2(cx == 0 ? -1 : 1, ry == 0 ? 1 : (ry == 2 ? -1 : 0));
    e[i] = level(region(p + dir).rgb);
  }
  color /= 6.0;

  // Depth discontinuity inside the cell: carve a silhouette.
  if (uEdges > 0.0 && dmax - dmin > uEdgeThreshold) {
    float mid = 0.5 * (dmin + dmax);
    for (int i = 0; i < 6; i++)
      s[i] = d[i] < mid ? mix(s[i], 1.0, uEdges) : s[i] * (1.0 - uEdges);
  }

  // Directional contrast: darken regions that sit next to something brighter.
  if (uDirContrast != 1.0) {
    for (int i = 0; i < 6; i++) {
      float m = max(s[i], e[i]);
      if (m > 0.0) s[i] = pow(s[i] / m, uDirContrast) * m;
    }
  }

  // Global contrast inside the cell: sharpens the shape the glyph must match.
  float m = max(max(max(s[0], s[1]), max(s[2], s[3])), max(s[4], s[5]));
  if (m > 0.0 && uContrast != 1.0)
    for (int i = 0; i < 6; i++) s[i] = pow(s[i] / m, uContrast) * m;

  vec4 a = vec4(s[0], s[1], s[2], s[3]);
  vec2 b = vec2(s[4], s[5]);
  float mean = (a.x + a.y + a.z + a.w + b.x + b.y) / 6.0;

  int best = 0;
  float bestDist = 1e9;
  for (int k = 0; k < uCount; k++) {
    vec4 ka = texelFetch(uShapes, ivec2(k, 0), 0);
    vec4 kb = texelFetch(uShapes, ivec2(k, 1), 0);
    float dist;
    if (uMode == 0) {
      vec4 da = ka - a;
      vec2 db = kb.xy - b;
      dist = dot(da, da) + dot(db, db);
    } else {
      dist = abs(kb.z - mean);
    }
    if (dist < bestDist) { bestDist = dist; best = k; }
  }

  // Keep hue; lift dark cells so sparse glyphs still carry colour.
  float peak = max(max(color.r, color.g), color.b);
  vec3 tint = color / max(peak, 0.25);
  outColor = vec4(float(best) / 255.0, tint);
}`;

/** Composite pass: full resolution, two texelFetches per pixel. */
export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uGlyphs;
uniform sampler2D uAtlas;
uniform ivec2 uCell;       // device px
uniform int uAtlasColumns;
uniform int uYOffset;      // anchors the grid to the top edge
uniform vec3 uFg;
uniform vec4 uBg;          // straight alpha
uniform float uColorMix;   // 0 = fg, 1 = scene colour
uniform float uScanlines;

out vec4 outColor;

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) + ivec2(0, uYOffset);
  ivec2 cell = p / uCell;
  ivec2 local = p - cell * uCell;
  vec4 g = texelFetch(uGlyphs, cell, 0);
  int idx = int(g.r * 255.0 + 0.5);
  ivec2 at = ivec2(idx % uAtlasColumns, idx / uAtlasColumns) * uCell
           + ivec2(local.x, uCell.y - 1 - local.y);
  float ink = texelFetch(uAtlas, at, 0).r;
  if (uScanlines > 0.0) ink *= 1.0 - uScanlines * float((int(gl_FragCoord.y) & 1) == 0);

  vec3 fg = mix(uFg, g.gba, uColorMix);
  float bgA = uBg.a * (1.0 - ink);
  outColor = vec4(fg * ink + uBg.rgb * bgA, ink + bgA);
}`;
