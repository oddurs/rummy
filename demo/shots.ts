/**
 * Contact sheet: every scene in every look, plus a few feature comparisons,
 * rendered deterministically (fixed time, no pointer, fully refined).
 *
 * Open /shots.html to look at it; scripts/shots.mjs drives the same page
 * headlessly through `window.__shots` to write PNGs and diffs.
 */
import { Rummy, charsets, defaults, scenes, type RummyOptions, type SceneName } from '../src';
import { lookDefaults, looks, type LookName } from './looks';

interface Shot {
  name: string;
  scene: SceneName | 'source';
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
}

async function render(name: string): Promise<string> {
  const shot = shots.find((s) => s.name === name);
  if (!shot) throw new Error(`no shot named ${name}`);
  const options = { ...base, ...shot.options, scene: shot.scene === 'source' ? dark : scenes[shot.scene] };
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

declare global {
  interface Window {
    __shots: {
      ready: Promise<void>;
      list: string[];
      render: typeof render;
      diff: typeof diff;
      montage: typeof montage;
    };
  }
}

const readyPromise = ready();
window.__shots = { ready: readyPromise, list: shots.map((s) => s.name), render, diff, montage };

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
