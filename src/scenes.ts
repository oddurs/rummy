/**
 * Built-in scenes. Each is a GLSL snippet defining `vec4 scene(vec2 uv)`
 * (rgb + depth in 0..1). They run at cell resolution, so a generous raymarch
 * budget is still cheap. Helpers available: rot, screen, noise, fbm, hash12/13,
 * and uniforms uTime, uMouse, uScroll, uDetail, uAspect, uResolution, uOffset.
 * Scenes scale their expensive loops with uDetail, which the frame-time
 * governor lowers when frames run late.
 *
 * `#define STILL t` marks each scene's composed moment: rummy starts there,
 * and it is the frame shown under prefers-reduced-motion.
 *
 * Composed for heroes: one focal point, a clear tonal hierarchy (most of the
 * frame mid-ramp, highlights reserved for the focus), and motion slow enough
 * to read as drift rather than noise.
 */

const RAYMARCH_NORMAL = /* glsl */ `
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}`;

/** A twisted square torus, slowly tumbling, lit like brushed metal. */
export const ring = /* glsl */ `
#define STILL 2.2
float map(vec3 p) {
  p.yz *= rot(0.55 + uMouse.y * 0.4 + sin(uTime * 0.31) * 0.15);
  p.xz *= rot(uTime * 0.22 + uMouse.x * 0.9 + uScroll * 1.6);
  p.xy *= rot(0.35);
  float a = atan(p.z, p.x);
  vec2 q = vec2(length(p.xz) - 1.0, p.y);
  q *= rot(a * 1.5 + uTime * 0.5);
  vec2 d = abs(q) - vec2(0.3);
  return (length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.03) * 0.7;
}
${RAYMARCH_NORMAL}
vec4 scene(vec2 uv) {
  vec2 p = screen(uv);
  // Scrolling pulls the camera back as the ring turns away.
  vec3 ro = vec3(0.0, 0.0, 3.4 + uScroll * 2.2);
  vec3 rd = normalize(vec3(p, -1.9));
  float t = 0.0;
  bool hit = false;
  int steps = int(mix(32.0, 90.0, uDetail));
  for (int i = 0; i < 90; i++) {
    if (i >= steps) break;
    float d = map(ro + rd * t);
    if (d < 0.001) { hit = true; break; }
    t += d;
    if (t > 10.0) break;
  }
  if (!hit) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 pos = ro + rd * t;
  vec3 n = calcNormal(pos);
  vec3 l = normalize(vec3(0.6, 0.8, 0.5));
  float dif = max(dot(n, l), 0.0);
  float fill = max(dot(n, normalize(vec3(-0.7, -0.2, 0.4))), 0.0);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  float spec = pow(max(dot(reflect(rd, n), l), 0.0), 40.0);
  // A soft horizon in the reflection gives flat faces a gradient to draw.
  float env = smoothstep(-0.2, 0.6, reflect(rd, n).y);
  float lum = 0.03 + 0.5 * dif * dif + 0.12 * fill + 0.25 * env + 0.4 * rim + 1.1 * spec;
  vec3 col = mix(vec3(0.15, 0.85, 1.0), vec3(1.0, 0.3, 0.75), 0.5 + 0.5 * n.y) * lum;
  return vec4(col, t / 8.0);
}`;

/** Flying down a gridded valley between ridges, toward a striped sun. */
export const terrain = /* glsl */ `
#define STILL 6.0
float ridges(vec2 p, int octaves) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    v += a * noise(p);
    p = rot(0.6) * p * 2.03;
    a *= 0.5;
  }
  return v;
}
float height(vec2 p, int octaves) {
  float side = smoothstep(0.8, 3.5, abs(p.x));
  if (side == 0.0) return 0.0;
  float h = ridges(p * 0.32, octaves);
  return h * h * 4.2 * side;
}
float height(vec2 p) { return height(p, 4); }
vec4 scene(vec2 uv) {
  vec2 p = screen(uv);
  // Scrolling lifts the camera over the valley and tips it down.
  float horizon = 0.1 + uScroll * 0.45;
  vec3 ro = vec3(uMouse.x * 0.6, 0.55 + uMouse.y * 0.15 + uScroll * 1.6, -uTime * 1.6);
  vec3 rd = normalize(vec3(p.x, p.y - horizon, -1.6));
  rd.xy *= rot(sin(uTime * 0.23) * 0.03);

  // Sky: deep gradient, a few stars, and the sun sitting on the horizon.
  float up = p.y - horizon;
  vec3 sky = mix(vec3(0.16, 0.03, 0.22), vec3(0.01, 0.0, 0.04), smoothstep(0.0, 0.8, up));
  sky += step(0.996, hash12(floor(uv * uResolution * 0.5))) * 0.35 * smoothstep(0.1, 0.4, up);
  vec2 sp = vec2(p.x, p.y - horizon - 0.2);
  float disc = smoothstep(0.34, 0.325, length(sp));
  // Bands cut from the lower half, widening toward the horizon.
  float band = sp.y > 0.02 ? 1.0 : step(0.35 - sp.y * 1.6, fract(sp.y * 11.0 + uTime * 0.25));
  vec3 sunCol = mix(vec3(1.0, 0.2, 0.55), vec3(1.0, 0.8, 0.3), smoothstep(-0.3, 0.3, sp.y));
  sky = mix(sky, sunCol * (0.55 + 0.25 * smoothstep(-0.3, 0.3, sp.y)), disc * band);
  sky += sunCol * 0.18 * exp(-max(length(sp) - 0.33, 0.0) * 9.0) * (1.0 - disc);

  // March only as far as a ray can still meet the tallest ridge, and never
  // past the floor plane: ridges only rise from it, so its hit is an upper bound.
  float tmax = rd.y > 0.0 ? min(40.0, (4.2 - ro.y) / rd.y) : min(40.0, -ro.y / rd.y);
  float t = 0.05;
  bool hit = rd.y < 0.0 && tmax < 40.0;
  int steps = int(mix(28.0, 64.0, uDetail));
  int octaves = uDetail < 0.5 ? 2 : 3;
  for (int i = 0; i < 64; i++) {
    if (i >= steps) break;
    vec3 q = ro + rd * t;
    // Few octaves to find the surface; the last only matters for shading.
    float h = q.y - height(q.xz, octaves);
    if (h < 0.002 * t) { hit = true; break; }
    t += max(h * 0.55, 0.01);
    if (t > tmax) { t = tmax; break; }
  }
  if (!hit) return vec4(sky, 1.0);

  vec3 pos = ro + rd * t;
  vec2 e = vec2(0.06, 0.0);
  vec3 n = normalize(vec3(height(pos.xz - e.xy) - height(pos.xz + e.xy), 2.0 * e.x,
                          height(pos.xz - e.yx) - height(pos.xz + e.yx)));
  float dif = max(dot(n, normalize(vec3(0.0, 0.5, -1.0))), 0.0);

  // Grid lines, about one sample wide at any distance. The width comes from
  // the ray's footprint, not fwidth: derivatives after the march's early exits
  // are undefined.
  vec2 g = pos.xz * 2.0;
  float footprint = t * 2.0 / (uResolution.y * 1.6) * 2.0;
  vec2 w = min(vec2(footprint, footprint / max(-rd.y, 0.04)) * 1.4, vec2(0.45));
  vec2 toLine = 0.5 - abs(fract(g) - 0.5);
  vec2 gl = 1.0 - smoothstep(vec2(0.0), w, toLine);
  float grid = max(gl.x, gl.y);
  float floorMask = 1.0 - smoothstep(0.05, 0.4, pos.y);

  vec3 rock = vec3(0.1, 0.75, 0.85) * (0.06 + 0.55 * dif);
  vec3 col = rock * (1.0 - floorMask * 0.85) + vec3(1.0, 0.25, 0.8) * grid * mix(0.3, 0.75, floorMask);
  float fog = 1.0 - exp(-t * 0.08);
  return vec4(mix(col, sky * 0.6 + vec3(0.12, 0.02, 0.16), fog), t / 40.0);
}`;

/** Liquid metal: a cluster of smooth-unioned spheres, the core led by the pointer. */
export const blobs = /* glsl */ `
#define STILL 5.0
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float map(vec3 p) {
  float d = length(p - vec3(uMouse * vec2(0.6, 0.4), 0.0)) - 0.75;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec3 c = vec3(sin(uTime * (0.35 + fi * 0.09) + fi * 1.7) * 1.05,
                  cos(uTime * (0.28 + fi * 0.07) + fi * 2.3) * 0.7,
                  sin(uTime * 0.23 + fi) * 0.5);
    d = smin(d, length(p - c) - (0.36 + 0.1 * sin(fi * 3.1)), 0.6);
  }
  return d;
}
${RAYMARCH_NORMAL}
vec4 scene(vec2 uv) {
  vec2 p = screen(uv);
  vec3 ro = vec3(0.0, 0.0, 3.6);
  vec3 rd = normalize(vec3(p, -2.0));
  float t = 0.0;
  bool hit = false;
  int steps = int(mix(28.0, 72.0, uDetail));
  for (int i = 0; i < 72; i++) {
    if (i >= steps) break;
    float d = map(ro + rd * t);
    if (d < 0.001) { hit = true; break; }
    t += d;
    if (t > 8.0) break;
  }
  if (!hit) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 pos = ro + rd * t;
  vec3 n = calcNormal(pos);
  vec3 r = reflect(rd, n);
  vec3 l = normalize(vec3(-0.5, 0.7, 0.6));
  float dif = max(dot(n, l), 0.0);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  float spec = pow(max(dot(r, l), 0.0), 32.0);
  // Studio reflection: a bright softbox above, a dark floor below.
  float env = smoothstep(-0.1, 0.8, r.y) * 0.26 + 0.04;
  float fill = max(dot(n, normalize(vec3(0.7, -0.3, 0.6))), 0.0);
  float lum = 0.02 + 0.36 * dif * dif + 0.14 * fill + env + 0.3 * fres + 1.0 * spec;
  vec3 col = mix(vec3(1.0, 0.62, 0.25), vec3(1.0, 0.9, 0.75), spec) * lum;
  return vec4(col, t / 8.0);
}`;

/** A rotating planet: continents, a graticule, a thin atmosphere. */
export const globe = /* glsl */ `
#define STILL 4.0
vec4 scene(vec2 uv) {
  // Scrolling sends the planet off into the distance, spinning.
  vec2 p = screen(uv) * (1.15 + uScroll * 1.1);
  float r2 = dot(p, p);
  vec3 L = normalize(vec3(-0.65, 0.45, 0.75));
  if (r2 > 1.0) {
    float r = sqrt(r2);
    // Thin, lit only on the day side, so it reads as air rather than a ring.
    float side = 0.35 + 0.65 * max(dot(normalize(vec3(p, 0.0)), L), 0.0);
    float halo = exp(-(r - 1.0) * 22.0) * 0.4 * side;
    return vec4(vec3(0.3, 0.6, 1.0) * halo, 1.0);
  }
  vec3 n = vec3(p, sqrt(1.0 - r2));
  vec3 q = n;
  q.yz *= rot(0.4 + uMouse.y * 0.3);
  q.xz *= rot(uTime * 0.16 + uMouse.x * 1.2 + uScroll * 3.0);
  float lat = asin(clamp(q.y, -1.0, 1.0));
  float lon = atan(q.z, q.x);
  float land = smoothstep(0.52, 0.55, fbm(q * 1.8 + 3.0));
  vec2 cell = abs(fract(vec2(lat, lon) / (PI / 9.0)) - 0.5);
  float grid = smoothstep(0.43, 0.5, max(cell.x, cell.y * cos(lat)));
  float light = max(dot(n, L), 0.0);
  float glint = pow(max(dot(reflect(vec3(0.0, 0.0, -1.0), n), L), 0.0), 24.0) * (1.0 - land);
  float night = 1.0 - smoothstep(0.0, 0.15, light);
  vec3 ocean = vec3(0.03, 0.1, 0.24);
  vec3 ground = vec3(0.2, 0.46, 0.26);
  vec3 col = mix(ocean, ground, land) * (0.08 + 0.95 * light);
  col += vec3(0.35, 0.75, 1.0) * grid * mix(0.45, 0.14, night) * (1.0 - 0.5 * land);
  col += vec3(1.0, 0.95, 0.8) * glint * 0.8;
  col += vec3(0.3, 0.6, 1.0) * pow(1.0 - n.z, 4.0) * 0.4 * (0.3 + light);
  return vec4(col, 0.5 - n.z * 0.4);
}`;

/** A wireframe tunnel: bright seams on dark panels, fading into the distance. */
export const tunnel = /* glsl */ `
#define STILL 2.4
vec4 scene(vec2 uv) {
  vec2 p = screen(uv) + uMouse * 0.3;
  p *= rot(uTime * 0.12);
  float r = pow(pow(abs(p.x), 6.0) + pow(abs(p.y), 6.0), 1.0 / 6.0);
  float a = atan(p.y, p.x) / TAU;
  float z = 0.35 / max(r, 0.001) + uTime * 1.1 + uScroll * 6.0;
  vec2 tuv = vec2(a * 8.0, z);
  vec2 w = fwidth(tuv) * 0.9 + 0.01;
  vec2 f = abs(fract(tuv) - 0.5);
  vec2 seam = smoothstep(0.5 - w, vec2(0.5), f);
  float lines = max(seam.x, seam.y);
  float near = smoothstep(0.05, 0.9, r);
  float panel = 0.05 + 0.05 * mod(floor(tuv.x) + floor(tuv.y), 2.0);
  vec3 col = vec3(0.2, 1.0, 0.5) * (lines * (0.18 + 0.5 * near) + panel * near);
  return vec4(col, clamp(1.0 - r, 0.0, 1.0));
}`;

export const scenes = { ring, terrain, blobs, globe, tunnel } as const;
export type SceneName = keyof typeof scenes;
