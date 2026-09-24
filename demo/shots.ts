/**
 * Contact sheet: every scene in every look, plus a few feature comparisons,
 * rendered deterministically (fixed time, no pointer, fully refined).
 *
 * Open /shots.html to look at it; scripts/shots.mjs drives the same page
 * headlessly through `window.__shots` to write PNGs and diffs.
 */
import { Rummy, charsets, defaults, palettes, scenes, type RummyOptions, type SceneName, type TransitionStyle } from '../src';
import { lookDefaults, looks, type LookName } from './looks';
import { buildAtlas, normalizeCharset } from '../src/atlas';

/** Test scenes: shapes and tones chosen to isolate one behaviour each. */
const testScenes = {
  // A flat, tall diamond whose edges run at the angle a / glyph draws
  // (about 2:1 in a monospace cell).
  spike: /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 p = screen(uv);
  float d = abs(p.x) * 2.1 + abs(p.y) - 0.85;
  return d > 0.0 ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(vec3(0.55), 0.3);
}`,
  // Custom uniforms of every kind: vec3, float, bool, sampler2D.
  uniforms: /* glsl */ `
uniform vec3 uTint;
uniform float uRadius;
uniform bool uRing;
uniform sampler2D uImage;
vec4 scene(vec2 uv) {
  vec2 p = screen(uv);
  float d = length(p);
  float shape = uRing ? smoothstep(0.04, 0.0, abs(d - uRadius)) : smoothstep(uRadius, uRadius - 0.02, d);
  vec3 img = texture(uImage, uv).rgb;
  return vec4(mix(img * 0.4, uTint, shape), 0.5);
}`,
  // uScroll as a fill from the left: the filled share of columns is its value.
  scrollbar: /* glsl */ `
vec4 scene(vec2 uv) {
  return vec4(vec3(step(uv.x, uScroll) * 0.9), 0.5);
}`,
  // A flat diamond: every silhouette is a 45° diagonal.
  diamond: /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 p = screen(uv);
  float d = abs(p.x) + abs(p.y) - 0.75;
  return d > 0.0 ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(vec3(0.55), 0.3);
}`,
  // A smooth two-hue ramp with falling brightness: banding shows up here first.
  gradient: /* glsl */ `
vec4 scene(vec2 uv) {
  vec3 c = mix(vec3(0.05, 0.12, 0.45), vec3(1.0, 0.5, 0.2), uv.x);
  return vec4(c * (0.25 + 0.75 * uv.y), 0.5);
}`,
};

interface Shot {
  name: string;
  scene: SceneName | 'source' | 'photo' | keyof typeof testScenes;
  options: Partial<RummyOptions>;
  /** CSS size; default 480x300. */
  size?: [number, number];
  /** Freeze a transition to another scene partway through. */
  transition?: { to: SceneName; style: TransitionStyle; at: number };
}

/** A deliberately underexposed "photo": what auto-exposure exists for. */
function darkSource(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 400;
  const ctx = c.getContext('2d')!;
  const sky = ctx.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#0d1420');
  sky.addColorStop(1, '#2a1d14');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 640, 400);
  ctx.fillStyle = '#3a3226';
  ctx.beginPath();
  ctx.arc(420, 150, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#07090c';
  ctx.beginPath();
  ctx.moveTo(0, 400);
  for (let x = 0; x <= 640; x += 40) ctx.lineTo(x, 260 + Math.sin(x * 0.02) * 40 + Math.cos(x * 0.05) * 20);
  ctx.lineTo(640, 400);
  ctx.fill();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 6;
  ctx.strokeRect(60, 60, 180, 120);
  return c;
}
const dark = darkSource();

/** Public-domain photo (NASA, AS11-40-5903); see demo/public/fixtures/README.md. */
const photo = new Image();
photo.src = 'fixtures/aldrin.jpg';

const base: Partial<RummyOptions> = {
  // Deterministic output: the governor would change detail with frame timing.
  adaptive: false,
  maxDpr: 1,
  mouse: false,
  pauseOffscreen: false,
  respectReducedMotion: false,
  fontSize: 10,
};

const shots: Shot[] = [];
for (const scene of Object.keys(scenes) as SceneName[]) {
  for (const look of Object.keys(looks) as LookName[]) {
    shots.push({ name: `${scene}-${look}`, scene, options: { ...lookDefaults, ...looks[look].options } });
  }
}
// Feature comparisons: each against the phosphor look it varies.
const phosphor = { ...lookDefaults, ...looks.phosphor.options };
shots.push(
  { name: 'ring-density', scene: 'ring', options: { ...phosphor, mode: 'density' } },
  { name: 'ring-no-edges', scene: 'ring', options: { ...phosphor, edges: 0 } },
  { name: 'tunnel-no-antialias', scene: 'tunnel', options: { ...phosphor, antialias: 0 } },
  { name: 'globe-no-antialias', scene: 'globe', options: { ...phosphor, antialias: 0 } },
  { name: 'globe-quality-2', scene: 'globe', options: { ...phosphor, antialias: 0, quality: 2 } },
  {
    name: 'terrain-blocks-two-tone',
    scene: 'terrain',
    options: { ...lookDefaults, ...looks.scene.options, charset: charsets.blocks, cellBackground: 1 },
  },
  { name: 'globe-lines', scene: 'globe', options: { ...phosphor, charset: charsets.lines } },
  ...(Object.keys(scenes) as SceneName[]).map((scene): Shot => ({
    name: `${scene}-hero`,
    scene,
    options: { ...phosphor, fontSize: 12 },
    size: [1200, 675],
  })),
  ...(Object.keys(scenes) as SceneName[]).map((scene): Shot => ({
    name: `${scene}-16px`,
    scene,
    options: { ...phosphor, fontSize: 16 },
    size: [960, 540],
  })),
  // Transitions, frozen halfway from ring to globe.
  ...(['decode', 'wipe', 'rain'] as TransitionStyle[]).map((style): Shot => ({
    name: `transition-${style}`,
    scene: 'ring',
    options: { ...lookDefaults, ...looks.scene.options },
    transition: { to: 'globe', style, at: 0.5 },
  })),
  // Before/after pairs for each look feature.
  // Scroll-driven camera moves, pinned halfway.
  ...(['ring', 'terrain', 'globe', 'tunnel'] as SceneName[]).map((scene): Shot => ({
    name: `${scene}-scrolled`,
    scene,
    options: { ...phosphor, scroll: 0.6 },
  })),
  { name: 'ring-no-glow', scene: 'ring', options: { ...phosphor, glow: 0 } },
  {
    name: 'terrain-two-tone',
    scene: 'terrain',
    options: { ...lookDefaults, ...looks.scene.options, cellBackground: 0.6 },
  },
  { name: 'tunnel-crt-off', scene: 'tunnel', options: { ...lookDefaults, ...looks.crt.options, crt: false, scanlines: 0 } },
  // Silhouettes on pure diagonals.
  { name: 'spike-edges', scene: 'spike', options: { ...phosphor, glow: 0, fontSize: 12 }, size: [960, 540] },
  { name: 'spike-no-edges', scene: 'spike', options: { ...phosphor, glow: 0, fontSize: 12, edges: 0 }, size: [960, 540] },
  { name: 'diamond-edges', scene: 'diamond', options: { ...phosphor, glow: 0, fontSize: 12 }, size: [960, 540] },
  { name: 'diamond-no-edges', scene: 'diamond', options: { ...phosphor, glow: 0, fontSize: 12, edges: 0 }, size: [960, 540] },
  // Palette banding on a smooth gradient.
  { name: 'gradient-scene', scene: 'gradient', options: { ...lookDefaults, ...looks.scene.options, glow: 0, fontSize: 12 }, size: [960, 540] },
  {
    name: 'gradient-ega-dither',
    scene: 'gradient',
    options: { ...lookDefaults, ...looks.scene.options, glow: 0, fontSize: 12, palette: palettes.ega, dither: 1 },
    size: [960, 540],
  },
  {
    name: 'gradient-ega-no-dither',
    scene: 'gradient',
    options: { ...lookDefaults, ...looks.scene.options, glow: 0, fontSize: 12, palette: palettes.ega, dither: 0 },
    size: [960, 540],
  },
  // A real photo at 12px.
  { name: 'photo-phosphor', scene: 'photo', options: { ...phosphor, fontSize: 12 }, size: [960, 540] },
  { name: 'photo-scene', scene: 'photo', options: { ...lookDefaults, ...looks.scene.options, fontSize: 12 }, size: [960, 540] },
  {
    name: 'photo-blocks-two-tone',
    scene: 'photo',
    options: { ...lookDefaults, ...looks.scene.options, charset: charsets.blocks, cellBackground: 1, fontSize: 12 },
    size: [960, 540],
  },
  {
    name: 'uniforms-a',
    scene: 'uniforms',
    options: { ...lookDefaults, ...looks.scene.options, glow: 0, uniforms: { uTint: [1, 0.55, 0.2], uRadius: 0.7, uRing: false } },
  },
  {
    name: 'uniforms-b',
    scene: 'uniforms',
    options: { ...lookDefaults, ...looks.scene.options, glow: 0, uniforms: { uTint: [0.3, 0.8, 1], uRadius: 0.45, uRing: true } },
  },
  { name: 'source-dark-auto', scene: 'source', options: { ...phosphor, exposure: 'auto' } },
  { name: 'source-dark-fixed', scene: 'source', options: { ...phosphor, exposure: 1 } },
);

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const sheet = document.getElementById('sheet')!;
const status = document.getElementById('status')!;

let rummy: Rummy | null = null;

async function ready(): Promise<void> {
  await document.fonts.load(`${defaults.fontWeight} 10px "JetBrains Mono"`);
  await document.fonts.ready;
  await photo.decode();
}

async function render(name: string): Promise<string> {
  const shot = shots.find((s) => s.name === name);
  if (!shot) throw new Error(`no shot named ${name}`);
  const scene =
    shot.scene === 'source' ? dark : shot.scene === 'photo' ? photo : shot.scene in testScenes ? testScenes[shot.scene as keyof typeof testScenes] : scenes[shot.scene as SceneName];
  const options = { ...base, ...shot.options, scene };
  if (shot.scene === 'uniforms') options.uniforms = { ...options.uniforms, uImage: photo };
  const [w, h] = shot.size ?? [480, 300];
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  if (!rummy) {
    rummy = new Rummy(canvas, options);
    rummy.pause();
  } else {
    // Reset every option to its default first, so shots never inherit state.
    rummy.set({ ...defaults, ...options });
  }
  rummy.resize();
  rummy.time = typeof options.scene === 'string' ? Rummy.stillOf(options.scene) : 0;
  for (let i = 0; i < 17; i++) rummy.render();
  if (shot.transition) {
    const { to, style, at } = shot.transition;
    void rummy.transition({ scene: scenes[to] }, { style, duration: 1000 });
    for (let i = 0; i < Math.round(at * 60); i++) rummy.step(1 / 60);
  }
  return canvas.toDataURL('image/png');
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Pixel diff: share of pixels that differ, plus a visualisation. */
async function diff(a: string, b: string): Promise<{ changed: number; image: string }> {
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const w = Math.max(ia.width, ib.width);
  const h = Math.max(ia.height, ib.height);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(ia, 0, 0);
  const da = ctx.getImageData(0, 0, w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(ib, 0, 0);
  const db = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  let changed = 0;
  for (let i = 0; i < da.data.length; i += 4) {
    const d =
      Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2]);
    const grey = (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 12;
    if (d > 24) {
      changed++;
      out.data.set([255, 40, 90, 255], i);
    } else {
      out.data.set([grey, grey, grey, 255], i);
    }
  }
  ctx.putImageData(out, 0, 0);
  return { changed: changed / (w * h), image: c.toDataURL('image/png') };
}

/** One image with every shot and its name, for review at a glance. */
async function montage(items: { name: string; url: string }[], columns = 4): Promise<string> {
  const imgs = await Promise.all(items.map((i) => load(i.url)));
  const w = 480;
  const h = 300;
  const label = 18;
  const c = document.createElement('canvas');
  c.width = columns * w;
  c.height = Math.ceil(imgs.length / columns) * (h + label);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = '12px ui-monospace, monospace';
  ctx.fillStyle = '#9a9aa2';
  imgs.forEach((img, i) => {
    const x = (i % columns) * w;
    const y = Math.floor(i / columns) * (h + label);
    ctx.fillText(items[i].name, x + 6, y + 13);
    ctx.drawImage(img, x, y + label, w, h);
  });
  return c.toDataURL('image/png');
}

// --- measurements -----------------------------------------------------------------

interface OutlineCount {
  cells: number;
  slashes: number;
  strokes: number;
  letters: number;
  other: number;
  top: [string, number][];
}

/** Classify the glyphs that draw an outline: non-space cells touching a space. */
function outline(text: string): OutlineCount {
  const rows = text.split('\n');
  const at = (x: number, y: number) => rows[y]?.[x] ?? ' ';
  const count: OutlineCount = { cells: 0, slashes: 0, strokes: 0, letters: 0, other: 0, top: [] };
  const freq = new Map<string, number>();
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const c = at(x, y);
      if (c === ' ') continue;
      if (at(x - 1, y) !== ' ' && at(x + 1, y) !== ' ' && at(x, y - 1) !== ' ' && at(x, y + 1) !== ' ') continue;
      count.cells++;
      freq.set(c, (freq.get(c) ?? 0) + 1);
      if (c === '/' || c === '\\') count.slashes++;
      else if ('|_-'.includes(c)) count.strokes++;
      else if (/[A-Za-z0-9]/.test(c)) count.letters++;
      else count.other++;
    }
  }
  count.top = [...freq].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return count;
}

/** How straight silhouettes are drawn, with and without directional edges. */
async function silhouettes(): Promise<Record<'spike' | 'diamond', { edges: OutlineCount; noEdges: OutlineCount; text: string }>> {
  const measure = async (shape: 'spike' | 'diamond') => {
    await render(`${shape}-edges`);
    const text = rummy!.toText();
    const edges = outline(text);
    await render(`${shape}-no-edges`);
    return { edges, noEdges: outline(rummy!.toText()), text };
  };
  return { spike: await measure('spike'), diamond: await measure('diamond') };
}

const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/**
 * Auto-exposure over time on a live source: a steady dark frame (does it hold
 * still?), then a cut to a bright one (does it settle without overshooting?).
 */
async function exposure(): Promise<{ steady: number[]; step: number[]; msPerFrame: number }> {
  const source = document.createElement('canvas');
  source.width = 320;
  source.height = 200;
  const ctx = source.getContext('2d')!;
  const paint = (bg: string, fg: string) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(200, 90, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(30, 130, 120, 40);
  };
  paint('#141414', '#3a3a3a');

  const probe = document.createElement('canvas');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:200px;';
  document.body.append(probe);
  const r = new Rummy(probe, { ...base, scene: source, exposure: 'auto', profile: true, maxDpr: 1 });
  const sample = async (n: number) => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      await frame();
      out.push(r.stats.exposure ?? NaN);
    }
    return out;
  };
  const t0 = performance.now();
  await sample(90); // settle
  const steady = await sample(60);
  paint('#b8b8b8', '#f4f4f4');
  const step = await sample(120);
  const msPerFrame = (performance.now() - t0) / 270;
  r.destroy();
  probe.remove();
  return { steady, step, msPerFrame };
}

interface ChurnResult {
  scene: string;
  /** Share of cells that flip and flip back within three frames (A→B→A). */
  flicker: number;
  flickerPoints: number;
  /** Share of cells changing per frame, real motion included. */
  churn: number;
  /** Share of cells differing from a fully refined still of the same moment. */
  error: number;
  errorPoints: number;
}

/**
 * Motion quality: the default renderer stepped at 60 fps through each scene,
 * beside one with point sampling (antialias 0), both compared with a fully
 * refined still of the same moment. Flicker counts A→B→A flips ("boil");
 * error is how far a moving frame strays from the ideal one.
 */
async function churn(frames = 90, extra: Partial<RummyOptions> = {}): Promise<ChurnResult[]> {
  const make = (options: Partial<RummyOptions>) => {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;';
    document.body.append(c);
    const r = new Rummy(c, { ...base, ...lookDefaults, ...looks.phosphor.options, fontSize: 10, ...options });
    r.pause();
    return { c, r };
  };
  const a = make(extra);
  const points = make({ ...extra, antialias: 0 });
  const truth = make({});
  const cells = (x: string) => x.replace(/\n/g, '');
  const differ = (x: string, y: string) => {
    let n = 0;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) n++;
    return n / Math.max(x.length, 1);
  };
  const flips = (f: string[]) => {
    let n = 0, total = 0;
    for (let t = 2; t < f.length; t++) {
      for (let i = 0; i < f[t].length; i++) {
        total++;
        if (f[t][i] === f[t - 2][i] && f[t][i] !== f[t - 1][i]) n++;
      }
    }
    return n / Math.max(total, 1);
  };
  const mean = (v: number[]) => v.reduce((x, y) => x + y, 0) / Math.max(v.length, 1);

  const results: ChurnResult[] = [];
  for (const name of Object.keys(scenes) as SceneName[]) {
    const start = Rummy.stillOf(scenes[name]);
    for (const { r } of [a, points, truth]) {
      r.set({ scene: scenes[name] });
      r.resize();
      r.time = start;
    }
    const fa: string[] = [], fp: string[] = [];
    const errA: number[] = [], errP: number[] = [];
    for (let f = 0; f < frames; f++) {
      a.r.step(1 / 60);
      points.r.step(1 / 60);
      if (f < 10) continue; // warm-up
      fa.push(cells(a.r.toText()));
      fp.push(cells(points.r.toText()));
      if (f % 10 === 0) {
        truth.r.time = start + (f + 1) / 60;
        for (let i = 0; i < 17; i++) truth.r.render();
        const t = cells(truth.r.toText());
        errA.push(differ(fa[fa.length - 1], t));
        errP.push(differ(fp[fp.length - 1], t));
      }
    }
    results.push({
      scene: name,
      flicker: flips(fa),
      flickerPoints: flips(fp),
      churn: mean(fa.slice(1).map((x, i) => differ(x, fa[i]))),
      error: mean(errA),
      errorPoints: mean(errP),
    });
  }
  for (const { r, c } of [a, points, truth]) {
    r.destroy();
    c.remove();
  }
  return results;
}

/**
 * Custom uniforms: values reach the scene, `set({ uniforms })` merges and never
 * recompiles, and an unknown name warns once instead of throwing.
 */
async function uniformsCheck(): Promise<{ compiles: number; changed: boolean; merged: boolean; warnings: number }> {
  let compiles = 0;
  const proto = WebGL2RenderingContext.prototype;
  const compile = proto.compileShader;
  proto.compileShader = function (this: WebGL2RenderingContext, shader: WebGLShader) {
    compiles++;
    return compile.call(this, shader);
  };
  let warnings = 0;
  const warn = console.warn;
  console.warn = () => void warnings++;
  try {
    await render('uniforms-a');
    const first = rummy!.toText();
    compiles = 0;
    rummy!.set({ uniforms: { uRadius: 0.45 } });
    for (let i = 0; i < 17; i++) rummy!.render();
    const smaller = rummy!.toText();
    rummy!.set({ uniforms: { uRing: true } });
    for (let i = 0; i < 17; i++) rummy!.render();
    const ring = rummy!.toText();
    rummy!.set({ uniforms: { uTypo: 1 } });
    rummy!.render();
    rummy!.render();
    // Merging: after three partial updates the tint from the first set must survive.
    const merged = JSON.stringify(rummy!.options.uniforms.uTint) === JSON.stringify([1, 0.55, 0.2]);
    return { compiles, changed: first !== smaller && smaller !== ring, merged, warnings };
  } finally {
    proto.compileShader = compile;
    console.warn = warn;
  }
}

/**
 * Scroll: uScroll follows the page (read once per frame, never while paused)
 * and a number pins it.
 */
async function scrollCheck(): Promise<{ tracked: number; pinned: number; readsPerFrame: number; readsWhilePaused: number }> {
  const spacer = document.createElement('div');
  spacer.style.cssText = 'height:4000px';
  document.body.append(spacer);
  const c = document.createElement('canvas');
  c.style.cssText = 'position:absolute;left:0;top:0;width:480px;height:400px;';
  document.body.append(c);
  const r = new Rummy(c, { ...base, fontSize: 10, antialias: 0, scene: testScenes.scrollbar, pauseOffscreen: false });
  const fill = () => {
    const rows = r.toText().split('\n');
    const row = rows[Math.floor(rows.length / 2)];
    return row.replace(/ +$/, '').length / row.length;
  };
  let reads = 0;
  const rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this === c) reads++;
    return rect.call(this);
  };
  try {
    window.scrollTo(0, 200); // canvas top 200px above the viewport: half of 400px
    for (let i = 0; i < 90; i++) await frame();
    const tracked = fill();
    reads = 0;
    for (let i = 0; i < 30; i++) await frame();
    const readsPerFrame = reads / 30;
    r.pause();
    await frame();
    reads = 0;
    for (let i = 0; i < 30; i++) await frame();
    const readsWhilePaused = reads;
    r.set({ scroll: 0.25 });
    r.render();
    const pinned = fill();
    return { tracked, pinned, readsPerFrame, readsWhilePaused };
  } finally {
    Element.prototype.getBoundingClientRect = rect;
    r.destroy();
    c.remove();
    spacer.remove();
    window.scrollTo(0, 0);
  }
}

/**
 * Transitions: they resolve and end on exactly the live frame, have all three
 * states (old, scramble, new) halfway, don't jump when interrupted, and finish
 * on a paused renderer in real time.
 */
async function transitionCheck(): Promise<{
  resolved: boolean;
  endsLive: boolean;
  halfway: { from: number; to: number; scramble: number };
  interruptJump: number;
  pausedFinishedMs: number;
}> {
  await render('ring-scene');
  const r = rummy!;
  const from = r.toText();
  let resolved = false;
  const done = r.transition({ scene: scenes.globe }, { style: 'decode', duration: 600 }).then(() => (resolved = true));
  const frames: string[] = [];
  for (let i = 0; i < 40; i++) {
    r.step(1 / 60);
    frames.push(r.toText());
  }
  await done;
  // Halfway through: which cells show the old frame, the new one, or scramble?
  const mid = frames[17];
  const end = frames[frames.length - 1];
  let f = 0, t = 0, x = 0, n = 0;
  for (let i = 0; i < mid.length; i++) {
    if (mid[i] === '\n' || (from[i] === ' ' && end[i] === ' ')) continue;
    n++;
    if (mid[i] === from[i]) f++;
    else if (mid[i] === end[i]) t++;
    else x++;
  }
  // A twin renderer makes the same change as a plain cut, stepped identically:
  // once the transition is over, the two must show exactly the same frame.
  const twinCanvas = document.createElement('canvas');
  twinCanvas.style.cssText = canvas.style.cssText;
  document.body.append(twinCanvas);
  const twin = new Rummy(twinCanvas, { ...r.options, scene: scenes.ring });
  twin.pause();
  twin.resize();
  twin.time = Rummy.stillOf(scenes.ring);
  for (let i = 0; i < 17; i++) twin.render();
  twin.set({ scene: scenes.globe });
  twin.time = r.time - 40 / 60;
  for (let i = 0; i < 40; i++) twin.step(1 / 60);
  const endsLive = twin.toText() === end;
  twin.destroy();
  twinCanvas.remove();

  // Interrupt partway: the next frame should look like the last one.
  void r.transition({ scene: scenes.ring }, { style: 'wipe', duration: 800 });
  for (let i = 0; i < 20; i++) r.step(1 / 60);
  const before = r.toText();
  const second = r.transition({ scene: scenes.tunnel }, { style: 'rain', duration: 800 });
  r.step(1 / 60);
  const after = r.toText();
  let changed = 0, cells = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i] === '\n') continue;
    cells++;
    if (before[i] !== after[i]) changed++;
  }
  for (let i = 0; i < 60; i++) r.step(1 / 60);
  await second;

  // Paused renderer, real time: it must still run the transition to the end.
  r.pause();
  const t0 = performance.now();
  await Promise.race([r.transition({ scene: scenes.blobs }, { duration: 400 }), new Promise((ok) => setTimeout(ok, 3000))]);
  const pausedFinishedMs = performance.now() - t0;

  return {
    resolved,
    endsLive,
    halfway: { from: f / n, to: t / n, scramble: x / n },
    interruptJump: changed / cells,
    pausedFinishedMs,
  };
}

/**
 * Governor, in real time on SwiftShader (a very slow GPU): a large terrain
 * should step down and get faster; once the canvas is small it should find its
 * way back up without flapping.
 */
async function governorCheck(): Promise<{
  fixedFps: number;
  governedFps: number;
  fixedDrawn: number;
  governedDrawn: number;
  levelSlow: number;
  levelUnderLoad: number;
  levelAfterRecovery: number;
  changesWhileSlow: number;
  levelFixed: number;
  load: string;
}> {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:720px;';
  document.body.append(c);
  const opts = { ...base, ...lookDefaults, ...looks.phosphor.options, scene: scenes.terrain, pauseOffscreen: false };
  // Page frames (how responsive everything else on the page stays) and
  // rummy's own drawn frames (stats.fps), over a window.
  const run = async (r: Rummy, seconds: number) => {
    const t0 = performance.now();
    let frames = 0, changes = 0, last = r.stats.level;
    const drawn: number[] = [];
    while (performance.now() - t0 < seconds * 1000) {
      await frame();
      frames++;
      drawn.push(r.stats.fps);
      if (r.stats.level !== last) changes++;
      last = r.stats.level;
    }
    const tail = drawn.slice(Math.floor(drawn.length / 2));
    return {
      fps: (frames * 1000) / (performance.now() - t0),
      drawn: tail.reduce((x, y) => x + y, 0) / Math.max(tail.length, 1),
      changes,
    };
  };
  // Baseline, governor off, escalating the load until it is genuinely slow
  // (under 30 fps), so the test can't pass on a machine with headroom.
  const loads: Partial<RummyOptions>[] = [
    { fontSize: 12 },
    { fontSize: 8 },
    { fontSize: 8, quality: 2 },
    { fontSize: 6, quality: 2 },
  ];
  let load: Partial<RummyOptions> = loads[0];
  let fixedRun = { fps: 0, drawn: 0, changes: 0 };
  let levelFixed = 0;
  for (const l of loads) {
    load = l;
    const fixed = new Rummy(c, { ...opts, ...l, adaptive: false });
    await run(fixed, 1);
    fixedRun = await run(fixed, 2);
    levelFixed = fixed.stats.level;
    fixed.destroy();
    if (fixedRun.fps < 30) break;
  }
  Object.assign(opts, load);
  // Governor on, same load.
  const r = new Rummy(c, { ...opts, adaptive: true });
  const settle = await run(r, 6);
  const levelSlow = r.stats.level;
  const governedRun = await run(r, 3);
  const levelUnderLoad = r.stats.level;
  // Make it cheap and let it climb back.
  c.style.width = '240px';
  c.style.height = '135px';
  r.resize();
  await run(r, 14);
  const levelAfterRecovery = r.stats.level;
  r.destroy();
  c.remove();
  return {
    fixedFps: fixedRun.fps,
    governedFps: governedRun.fps,
    fixedDrawn: fixedRun.drawn,
    governedDrawn: governedRun.drawn,
    levelSlow,
    levelUnderLoad,
    levelAfterRecovery,
    changesWhileSlow: settle.changes + governedRun.changes,
    levelFixed,
    load: JSON.stringify(load),
  };
}

/** Frame rate of a playing renderer under given options, in real time. For sizing the governor's levers. */
async function fpsUnder(options: Partial<RummyOptions>, seconds = 2): Promise<number> {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:720px;';
  document.body.append(c);
  const r = new Rummy(c, { ...base, ...lookDefaults, ...looks.phosphor.options, scene: scenes.terrain, pauseOffscreen: false, adaptive: false, ...options });
  for (let i = 0; i < 30; i++) await frame();
  const t0 = performance.now();
  let n = 0;
  while (performance.now() - t0 < seconds * 1000) {
    await frame();
    n++;
  }
  r.destroy();
  c.remove();
  return (n * 1000) / (performance.now() - t0);
}

/** Reduced motion: a transition is a dissolve with no scramble. Run with the media feature emulated. */
async function reducedTransitionCheck(): Promise<{ reduced: boolean; scramble: number }> {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;left:0;top:0;width:480px;height:300px;';
  document.body.append(c);
  // Two scenes with no motion, so every change is the transition's own.
  const r = new Rummy(c, { ...base, ...lookDefaults, ...looks.scene.options, respectReducedMotion: true, scene: testScenes.diamond });
  r.pause();
  r.resize();
  for (let i = 0; i < 17; i++) r.render();
  const from = r.toText();
  void r.transition({ scene: testScenes.spike }, { style: 'decode', duration: 900 });
  const frames: string[] = [];
  for (let i = 0; i < 30; i++) {
    r.step(1 / 60);
    frames.push(r.toText());
  }
  const end = frames[frames.length - 1];
  const mid = frames[7]; // about half of the shortened 250 ms dissolve
  let x = 0, n = 0;
  for (let i = 0; i < mid.length; i++) {
    if (mid[i] === '\n') continue;
    n++;
    if (mid[i] !== from[i] && mid[i] !== end[i]) x++;
  }
  r.destroy();
  c.remove();
  return { reduced, scramble: x / n };
}

/** Which glyph pairs flicker (A→B→A) in motion, most common first. For diagnosing boil. */
async function flickerPairs(scene: SceneName, frames = 60): Promise<[string, number][]> {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;';
  document.body.append(c);
  const r = new Rummy(c, { ...base, ...lookDefaults, ...looks.phosphor.options, fontSize: 10, scene: scenes[scene] });
  r.pause();
  r.resize();
  r.time = Rummy.stillOf(scenes[scene]);
  const f: string[] = [];
  for (let i = 0; i < frames; i++) {
    r.step(1 / 60);
    if (i >= 10) f.push(r.toText().replace(/\n/g, ''));
  }
  r.destroy();
  c.remove();
  const pairs = new Map<string, number>();
  for (let t = 2; t < f.length; t++) {
    for (let i = 0; i < f[t].length; i++) {
      if (f[t][i] === f[t - 2][i] && f[t][i] !== f[t - 1][i]) {
        const k = [f[t][i], f[t - 1][i]].sort().join('');
        pairs.set(k, (pairs.get(k) ?? 0) + 1);
      }
    }
  }
  return [...pairs].sort((x, y) => y[1] - x[1]).slice(0, 25);
}

/** Shape vectors for some glyphs, for debugging the matcher. */
function glyphShapes(glyphs: string, fontSize = 12): { strokeInk: number; shapes: Record<string, number[]> } {
  const atlas = buildAtlas(normalizeCharset(charsets.ascii), {
    family: defaults.fontFamily,
    weight: defaults.fontWeight,
    size: fontSize,
    lineHeight: defaults.lineHeight,
  });
  const n = atlas.chars.length;
  const shapes: Record<string, number[]> = {};
  for (const g of glyphs) {
    const i = atlas.chars.indexOf(g);
    const va = atlas.shapes.subarray(i * 4, i * 4 + 4);
    const vb = atlas.shapes.subarray((n + i) * 4, (n + i) * 4 + 2);
    shapes[g] = [...va, ...vb].map((v) => Math.round(v * 100) / 100);
  }
  return { strokeInk: atlas.strokeInk, shapes };
}

declare global {
  interface Window {
    __shots: {
      ready: Promise<void>;
      list: string[];
      render: typeof render;
      diff: typeof diff;
      montage: typeof montage;
      silhouettes: typeof silhouettes;
      exposure: typeof exposure;
      glyphShapes: typeof glyphShapes;
      churn: typeof churn;
      flickerPairs: typeof flickerPairs;
      uniformsCheck: typeof uniformsCheck;
      scrollCheck: typeof scrollCheck;
      transitionCheck: typeof transitionCheck;
      reducedTransitionCheck: typeof reducedTransitionCheck;
      governorCheck: typeof governorCheck;
      fpsUnder: typeof fpsUnder;
    };
  }
}

const readyPromise = ready();
window.__shots = {
  ready: readyPromise,
  list: shots.map((s) => s.name),
  render,
  diff,
  montage,
  silhouettes,
  exposure,
  glyphShapes,
  churn,
  flickerPairs,
  uniformsCheck,
  scrollCheck,
  transitionCheck,
  reducedTransitionCheck,
  governorCheck,
  fpsUnder,
};

// Headless runs drive the page themselves; people get the sheet.
if (!navigator.webdriver && !new URLSearchParams(location.search).has('driven')) {
  void readyPromise.then(async () => {
    const t0 = performance.now();
    for (const shot of shots) {
      const fig = document.createElement('figure');
      const img = new Image();
      img.src = await render(shot.name);
      img.alt = shot.name;
      const cap = document.createElement('figcaption');
      cap.textContent = shot.name;
      fig.append(img, cap);
      sheet.append(fig);
      await new Promise((r) => requestAnimationFrame(r));
    }
    status.textContent = `${shots.length} shots in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
  });
}
