/**
 * Built-in scenes. Each is a GLSL snippet defining `vec4 scene(vec2 uv)`
 * (rgb + depth in 0..1). They run at cell resolution, so a generous raymarch
 * budget is still cheap. Helpers available: rot, screen, noise, fbm, hash12/13,
 * and uniforms uTime, uMouse, uAspect, uResolution, uOffset.
 */

const RAYMARCH_NORMAL = /* glsl */ `
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}`;

/** A twisted square torus, slowly tumbling. */
export const ring = /* glsl */ `
float map(vec3 p) {
  p.yz *= rot(0.55 + uMouse.y * 0.4 + sin(uTime * 0.31) * 0.15);
  p.xz *= rot(uTime * 0.22 + uMouse.x * 0.9);
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
  vec3 ro = vec3(0.0, 0.0, 3.4);
  vec3 rd = normalize(vec3(p, -1.9));
  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 90; i++) {
    float d = map(ro + rd * t);
    if (d < 0.001) { hit = true; break; }
    t += d;
    if (t > 8.0) break;
  }
  if (!hit) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 pos = ro + rd * t;
  vec3 n = calcNormal(pos);
  vec3 l = normalize(vec3(0.6, 0.8, 0.5));
  float dif = max(dot(n, l), 0.0);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  float spec = pow(max(dot(reflect(rd, n), l), 0.0), 24.0);
  float lum = 0.06 + 0.7 * dif + 0.45 * rim + 0.6 * spec;
  vec3 col = mix(vec3(0.15, 0.85, 1.0), vec3(1.0, 0.3, 0.75), 0.5 + 0.5 * n.y) * lum;
  return vec4(col, t / 8.0);
}`;

/** Endless ridged terrain under a striped sun. */
export const terrain = /* glsl */ `
float height(vec2 p) {
  float h = fbm(p * 0.28);
  return h * h * 3.2 - 0.2;
}
vec4 scene(vec2 uv) {
  vec2 p = screen(uv);
  float z = -uTime * 1.4;
  vec3 ro = vec3(uMouse.x * 1.5, 0.0, z);
  ro.y = max(height(ro.xz), 0.0) * 0.4 + 1.5 + uMouse.y * 0.4;
  vec3 rd = normalize(vec3(p.x, p.y - 0.28, -1.4));
  rd.xy *= rot(sin(uTime * 0.25) * 0.06);

  vec3 sky = mix(vec3(0.02, 0.0, 0.08), vec3(0.45, 0.08, 0.4), smoothstep(0.6, -0.1, p.y));
  vec2 sp = p - vec2(0.0, 0.42);
  float sun = smoothstep(0.52, 0.49, length(sp));
  sun *= sp.y > 0.0 ? 1.0 : step(0.3 + sp.y * 1.2, fract(sp.y * 14.0 - uTime * 0.4));
  sky += sun * mix(vec3(1.0, 0.25, 0.5), vec3(1.0, 0.85, 0.3), smoothstep(-0.4, 0.4, sp.y));

  float t = 0.1;
  bool hit = false;
  for (int i = 0; i < 100; i++) {
    vec3 q = ro + rd * t;
    float h = q.y - height(q.xz);
    if (h < 0.002 * t) { hit = true; break; }
    t += h * 0.45;
    if (t > 40.0) break;
  }
  if (!hit) return vec4(sky, 1.0);

  vec3 pos = ro + rd * t;
  vec2 e = vec2(0.05, 0.0);
  vec3 n = normalize(vec3(height(pos.xz - e.xy) - height(pos.xz + e.xy), 2.0 * e.x,
                          height(pos.xz - e.yx) - height(pos.xz + e.yx)));
  float dif = max(dot(n, normalize(vec3(0.0, 0.6, -1.0))), 0.0);
  vec2 g = abs(fract(pos.xz * 0.5) - 0.5);
  float grid = smoothstep(0.44, 0.5, max(g.x, g.y));
  vec3 col = vec3(0.1, 0.9, 0.95) * (0.08 + 0.7 * dif) + vec3(1.0, 0.3, 0.8) * grid * 0.6;
  float fog = 1.0 - exp(-t * 0.07);
  return vec4(mix(col, sky, fog), t / 40.0);
}`;

/** Metaballs: smooth-unioned spheres orbiting a mouse-led core. */
export const blobs = /* glsl */ `
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float map(vec3 p) {
  float d = length(p - vec3(uMouse * vec2(1.2, 0.8), 0.0)) - 0.55;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec3 c = vec3(sin(uTime * (0.4 + fi * 0.13) + fi * 1.7) * 1.4,
                  cos(uTime * (0.3 + fi * 0.11) + fi * 2.3) * 0.9,
                  sin(uTime * 0.27 + fi) * 0.6);
    d = smin(d, length(p - c) - (0.28 + 0.08 * sin(fi * 3.1)), 0.55);
  }
  return d;
}
${RAYMARCH_NORMAL}
vec4 scene(vec2 uv) {
  vec2 p = screen(uv);
  vec3 ro = vec3(0.0, 0.0, 4.0);
  vec3 rd = normalize(vec3(p, -2.0));
  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 72; i++) {
    float d = map(ro + rd * t);
    if (d < 0.001) { hit = true; break; }
    t += d;
    if (t > 9.0) break;
  }
  if (!hit) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 pos = ro + rd * t;
  vec3 n = calcNormal(pos);
  float dif = max(dot(n, normalize(vec3(-0.5, 0.7, 0.6))), 0.0);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
  vec3 col = vec3(1.0, 0.72, 0.3) * (0.05 + 0.8 * dif) + vec3(1.0, 0.3, 0.1) * rim * 0.7;
  return vec4(col, t / 9.0);
}`;

/** A rotating wireframe planet with drifting continents. */
export const globe = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 p = screen(uv) * 1.2;
  float r2 = dot(p, p);
  if (r2 > 1.0) {
    float halo = exp(-(sqrt(r2) - 1.0) * 7.0) * 0.45;
    return vec4(vec3(0.3, 0.6, 1.0) * halo, 1.0);
  }
  vec3 n = vec3(p, sqrt(1.0 - r2));
  vec3 q = n;
  q.yz *= rot(0.4 + uMouse.y * 0.3);
  q.xz *= rot(uTime * 0.18 + uMouse.x * 1.2);
  float lat = asin(clamp(q.y, -1.0, 1.0));
  float lon = atan(q.z, q.x);
  float land = smoothstep(0.52, 0.56, fbm(q * 1.8 + 3.0));
  vec2 gl = abs(fract(vec2(lat, lon) / (PI / 9.0)) - 0.5);
  float grid = smoothstep(0.42, 0.5, max(gl.x, gl.y * cos(lat)));
  float light = max(dot(n, normalize(vec3(-0.6, 0.5, 0.8))), 0.0);
  float rim = pow(1.0 - n.z, 3.0);
  vec3 col = mix(vec3(0.05, 0.25, 0.6), vec3(0.5, 1.0, 0.6), land) * (0.12 + 0.9 * light);
  col += vec3(0.4, 0.8, 1.0) * (grid * 0.35 + rim * 0.5);
  return vec4(col, 0.5 - n.z * 0.4);
}`;

/** Classic demoscene tunnel. */
export const tunnel = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 p = screen(uv) + uMouse * 0.35;
  p *= rot(uTime * 0.15);
  float r = pow(pow(abs(p.x), 6.0) + pow(abs(p.y), 6.0), 1.0 / 6.0);
  float a = atan(p.y, p.x) / TAU;
  float z = 0.35 / max(r, 0.001) + uTime * 1.2;
  vec2 tuv = vec2(a * 8.0, z);
  vec2 f = abs(fract(tuv) - 0.5);
  float lines = smoothstep(0.38, 0.5, max(f.x, f.y));
  float check = mod(floor(tuv.x) + floor(tuv.y), 2.0);
  float shade = clamp(r * 1.3, 0.0, 1.0);
  vec3 col = (vec3(0.2, 1.0, 0.45) * lines + vec3(0.1, 0.5, 0.25) * check * 0.35) * shade;
  return vec4(col, clamp(1.0 - r, 0.0, 1.0));
}`;

export const scenes = { ring, terrain, blobs, globe, tunnel } as const;
export type SceneName = keyof typeof scenes;
