/**
 * Bench: every built-in scene at a fixed canvas size, GPU time per pass from
 * timer queries where the browser has them, frame interval otherwise. Prints a
 * Markdown table to paste into an issue. scripts/bench.mjs drives it headlessly.
 */
import { Rummy, defaults, scenes, type GpuTimes, type RummyOptions, type SceneName } from '../src';
import { lookDefaults, looks } from './looks';

interface Row {
  scene: string;
  size: string;
  cells: number;
  samples: number;
  gpu: GpuTimes | null;
  frameMs: number;
}

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const out = document.getElementById('out')!;
const params = new URLSearchParams(location.search);
const seconds = Number(params.get('seconds') ?? 3);

const sizes: [number, number][] = [
  [1920, 1080],
  [2560, 1440],
];

function renderer(): string {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return 'no WebGL2';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
}

const frame = () => new Promise<number>((r) => requestAnimationFrame(r));

async function measure(rummy: Rummy, ms: number): Promise<{ gpu: GpuTimes | null; frameMs: number }> {
  // Warm up: shader compile, first uploads, timer queries filling the pipe.
  const warm = performance.now() + 600;
  while (performance.now() < warm) await frame();
  let frames = 0;
  const start = await frame();
  let now = start;
  while (now - start < ms) {
    now = await frame();
    frames++;
  }
  return { gpu: rummy.stats.gpu ? { ...rummy.stats.gpu } : null, frameMs: (now - start) / frames };
}

async function run(options: Partial<RummyOptions> = {}): Promise<{ renderer: string; rows: Row[]; markdown: string }> {
  const rows: Row[] = [];
  const base: Partial<RummyOptions> = {
    ...lookDefaults,
    ...looks.phosphor.options,
    maxDpr: 1,
    profile: true,
    pauseOffscreen: false,
    respectReducedMotion: false,
    ...options,
  };
  const rummy = new Rummy(canvas, base);
  for (const [w, h] of sizes) {
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    for (const name of Object.keys(scenes) as SceneName[]) {
      rummy.set({ ...defaults, ...base, scene: scenes[name] });
      out.textContent = `measuring ${name} at ${w}x${h}…`;
      const { gpu, frameMs } = await measure(rummy, seconds * 1000);
      rows.push({ scene: name, size: `${w}x${h}`, cells: rummy.stats.columns * rummy.stats.rows, samples: rummy.stats.samples, gpu, frameMs });
    }
  }
  rummy.destroy();

  const r = renderer();
  const f = (v: number | undefined) => (v === undefined ? '–' : v.toFixed(2));
  const markdown = [
    `GPU: ${r}  `,
    `UA: ${navigator.userAgent}  `,
    `Options: phosphor look, fontSize ${base.fontSize ?? defaults.fontSize}, antialias ${base.antialias ?? defaults.antialias}, glow ${base.glow}`,
    '',
    '| scene | canvas | cells | samples | scene ms | glyph ms | glow ms | composite ms | **GPU total ms** | frame ms |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...rows.map(
      (row) =>
        `| ${row.scene} | ${row.size} | ${row.cells.toLocaleString()} | ${row.samples.toLocaleString()} | ${f(row.gpu?.scene)} | ${f(row.gpu?.glyph)} | ${f(row.gpu?.glow)} | ${f(row.gpu?.composite)} | **${f(row.gpu?.total)}** | ${row.frameMs.toFixed(2)} |`,
    ),
    '',
    rows.some((row) => row.gpu) ? '' : '_No GPU timer queries in this browser; only frame interval is reported._',
  ].join('\n');
  out.textContent = markdown;
  return { renderer: r, rows, markdown };
}

declare global {
  interface Window {
    __bench: { run: typeof run };
  }
}
window.__bench = { run };
document.getElementById('run')!.addEventListener('click', () => void run());
