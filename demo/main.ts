import { Rummy, charsets, scenes, type RummyOptions, type SceneName } from '../src';

const palettes = {
  phosphor: { fg: '#9dffb0', bg: '#050805', accent: '#9dffb0', text: '#d7ffe0', dim: '#6f8f76', colorMix: 0 },
  amber: { fg: '#ffb000', bg: '#0b0700', accent: '#ffb000', text: '#ffe7b0', dim: '#8f7a4f', colorMix: 0 },
  paper: { fg: '#1b1b18', bg: '#efe9dc', accent: '#1b1b18', text: '#1b1b18', dim: '#77736a', colorMix: 0 },
  ice: { fg: '#bfe6ff', bg: '#04070d', accent: '#8fd3ff', text: '#e3f4ff', dim: '#5d7489', colorMix: 0 },
  scene: { fg: '#ffffff', bg: '#030304', accent: '#ff5fc8', text: '#f3eefc', dim: '#7c7590', colorMix: 1 },
} as const;
type Palette = keyof typeof palettes;

interface State {
  scene: SceneName | 'media';
  charset: keyof typeof charsets;
  mode: RummyOptions['mode'];
  palette: Palette;
  fontSize: number;
  contrast: number;
  directionalContrast: number;
  edges: number;
  gain: number;
  scanlines: number;
  quality: boolean;
  paused: boolean;
}

const initial: State = {
  scene: 'ring',
  charset: 'ascii',
  mode: 'shape',
  palette: 'phosphor',
  fontSize: 12,
  contrast: 1.6,
  directionalContrast: 2,
  edges: 0.5,
  gain: 0.85,
  scanlines: 0,
  quality: false,
  paused: false,
};

function readHash(): State {
  const state = { ...initial };
  const params = new URLSearchParams(location.hash.slice(1));
  for (const [key, raw] of params) {
    if (!(key in state)) continue;
    const k = key as keyof State;
    const cur = state[k];
    (state as Record<string, unknown>)[k] =
      typeof cur === 'number' ? Number(raw) : typeof cur === 'boolean' ? raw === '1' : raw;
  }
  if (state.scene === 'media' || !(state.scene in scenes)) state.scene = initial.scene;
  if (!(state.charset in charsets)) state.charset = initial.charset;
  if (!(state.palette in palettes)) state.palette = initial.palette;
  return state;
}

function writeHash(state: State): void {
  const params = new URLSearchParams();
  for (const k of Object.keys(state) as (keyof State)[]) {
    const v = state[k];
    if (v === initial[k] || k === 'scene' && v === 'media') continue;
    params.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  history.replaceState(null, '', params.size ? `#${params}` : location.pathname + location.search);
}

const canvas = document.getElementById('bg') as HTMLCanvasElement;
const form = document.getElementById('controls') as HTMLFormElement;
const stats = document.getElementById('stats')!;
const sceneLabel = document.getElementById('scene-label')!;

let state = readHash();
if (new URLSearchParams(location.hash.slice(1)).get('ui') === '0') document.body.classList.add('bare');
let media: HTMLImageElement | HTMLVideoElement | null = null;

function focalOffset(): [number, number] {
  if (document.body.classList.contains('bare')) return [0, 0];
  const aspect = innerWidth / innerHeight;
  return innerWidth > 900 ? [Math.min(0.85, aspect * 0.32), 0] : [0, 0.45];
}

function toOptions(s: State): Partial<RummyOptions> {
  const p = palettes[s.palette];
  return {
    scene: s.scene === 'media' && media ? media : scenes[s.scene as SceneName] ?? scenes.ring,
    charset: charsets[s.charset],
    mode: s.mode,
    fg: p.fg,
    bg: p.bg,
    colorMix: p.colorMix,
    fontSize: s.fontSize,
    contrast: s.contrast,
    directionalContrast: s.directionalContrast,
    edges: s.edges,
    gain: s.gain,
    scanlines: s.scanlines,
    quality: s.quality ? 2 : 1,
    offset: s.scene === 'media' ? [0, 0] : focalOffset(),
  };
}

function applyPalette(name: Palette): void {
  const p = palettes[name];
  const root = document.documentElement.style;
  root.setProperty('--bg', p.bg);
  root.setProperty('--fg', p.text);
  root.setProperty('--accent', p.accent);
  root.setProperty('--dim', p.dim);
  root.setProperty('--line', `color-mix(in srgb, ${p.accent} 25%, transparent)`);
  root.setProperty('--panel', `color-mix(in srgb, ${p.bg} 85%, transparent)`);
  document.documentElement.style.colorScheme = name === 'paper' ? 'light' : 'dark';
}

function syncForm(s: State): void {
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    const k = el.name as keyof State;
    if (!(k in s)) continue;
    if (el.type === 'checkbox') el.checked = Boolean(s[k]);
    else el.value = String(s[k]);
    const out = form.elements.namedItem(`${k}Out`) as HTMLOutputElement | null;
    if (out) out.value = String(s[k]);
  }
  sceneLabel.textContent = s.scene === 'media' ? 'dropped-file' : s.scene;
}

const rummy = new Rummy(canvas, toOptions(state));
if (state.paused) rummy.pause();
applyPalette(state.palette);
syncForm(state);

function update(next: State): void {
  state = next;
  rummy.set(toOptions(state));
  if (state.paused) rummy.pause();
  else rummy.play();
  applyPalette(state.palette);
  syncForm(state);
  writeHash(state);
}

form.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const k = el.name as keyof State;
  if (!(k in state)) return;
  const cur = state[k];
  const value = el.type === 'checkbox' ? el.checked : typeof cur === 'number' ? Number(el.value) : el.value;
  update({ ...state, [k]: value });
});
form.addEventListener('submit', (e) => e.preventDefault());

addEventListener('resize', () => rummy.set({ offset: state.scene === 'media' ? [0, 0] : focalOffset() }));

const toggle = document.getElementById('panel-toggle')!;
const panel = document.getElementById('panel')!;
function setCollapsed(collapsed: boolean): void {
  panel.toggleAttribute('data-collapsed', collapsed);
  toggle.textContent = collapsed ? '[+] tune' : '[-] tune';
  toggle.setAttribute('aria-expanded', String(!collapsed));
}
setCollapsed(innerWidth < 720);
toggle.addEventListener('click', () => setCollapsed(!panel.hasAttribute('data-collapsed')));

setInterval(() => {
  const s = rummy.stats;
  const pixels = s.width * s.height;
  stats.textContent =
    `${s.columns}x${s.rows} cells · ${s.samples.toLocaleString()} samples ` +
    `(${((s.samples / Math.max(1, pixels)) * 100).toFixed(1)}% of ${pixels.toLocaleString()} px) · ${s.fps.toFixed(0)} fps`;
}, 500);

// Drag an image or video in to asciify it.
addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragging');
});
addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) document.body.classList.remove('dragging');
});
addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  if (media instanceof HTMLVideoElement) media.pause();
  if (media) URL.revokeObjectURL(media.src);
  if (file.type.startsWith('video/')) {
    const video = document.createElement('video');
    Object.assign(video, { src: url, muted: true, loop: true, playsInline: true });
    void video.play();
    media = video;
  } else if (file.type.startsWith('image/')) {
    const img = new Image();
    img.src = url;
    media = img;
    img.onload = () => rummy.set({ scene: img });
  } else {
    return;
  }
  const option = form.querySelector<HTMLOptionElement>('option[value="media"]')!;
  option.disabled = false;
  update({ ...state, scene: 'media' });
});
