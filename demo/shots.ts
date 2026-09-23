/**
 * Contact sheet: every scene in every look, plus a few feature comparisons,
 * rendered deterministically (fixed time, no pointer, fully refined).
 *
 * Open /shots.html to look at it; scripts/shots.mjs drives the same page
 * headlessly through `window.__shots` to write PNGs and diffs.
 */
import { Rummy, charsets, defaults, palettes, scenes, type RummyOptions, type SceneName } from '../src';
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
  // Before/after pairs for each look feature.
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

const frame = () => new Promise<number>((r) => requestAnimationFrame(r));

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
    const a = atlas.shapes.subarray(i * 4, i * 4 + 4);
    const b = atlas.shapes.subarray((n + i) * 4, (n + i) * 4 + 2);
    shapes[g] = [...a, ...b].map((v) => Math.round(v * 100) / 100);
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
    };
  }
}

const readyPromise = ready();
window.__shots = { ready: readyPromise, list: shots.map((s) => s.name), render, diff, montage, silhouettes, exposure, glyphShapes };

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
