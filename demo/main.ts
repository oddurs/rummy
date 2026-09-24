import { Rummy, charsets, palettes, scenes, type RummyOptions, type SceneName } from '../src';
import { lookDefaults, looks, type LookName } from './looks';

interface State {
  scene: SceneName | 'media';
  charset: keyof typeof charsets;
  mode: RummyOptions['mode'];
  look: LookName;
  quantize: keyof typeof palettes | 'none';
  fontSize: number;
  contrast: number;
  directionalContrast: number;
  edges: number;
  gain: number;
  glow: number;
  cellBackground: number;
  antialias: number;
  crt: boolean;
  quality: boolean;
  paused: boolean;
}

const initial: State = {
  scene: 'ring',
  charset: 'ascii',
  mode: 'shape',
  look: 'phosphor',
  quantize: 'none',
  fontSize: 12,
  contrast: 1.6,
  directionalContrast: 2,
  edges: 0.6,
  gain: 0.85,
  glow: -1,
  cellBackground: -1,
  antialias: 0.6,
  crt: false,
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
  if (!(state.look in looks)) state.look = initial.look;
  if (state.quantize !== 'none' && !(state.quantize in palettes)) state.quantize = 'none';
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

/** -1 on a slider means "whatever the look says". */
const orLook = (v: number, look: number | undefined) => (v < 0 ? (look ?? 0) : v);

function toOptions(s: State): Partial<RummyOptions> {
  const look: Partial<RummyOptions> = { ...lookDefaults, ...looks[s.look].options };
  return {
    ...look,
    scene: s.scene === 'media' && media ? media : scenes[s.scene as SceneName] ?? scenes.ring,
    charset: charsets[s.charset],
    mode: s.mode,
    fontSize: s.fontSize,
    contrast: s.contrast,
    directionalContrast: s.directionalContrast,
    edges: s.edges,
    gain: s.gain,
    glow: orLook(s.glow, look.glow),
    cellBackground: orLook(s.cellBackground, look.cellBackground),
    antialias: s.antialias,
    palette: s.quantize === 'none' ? look.palette ?? null : palettes[s.quantize],
    colorMix: s.quantize === 'none' ? look.colorMix : 1,
    crt: s.crt || look.crt || false,
    quality: s.quality ? 2 : 1,
    offset: s.scene === 'media' ? [0, 0] : focalOffset(),
  };
}

function applyLook(name: LookName): void {
  const { options, theme } = looks[name] as (typeof looks)[LookName] & { theme: { light?: boolean } };
  const root = document.documentElement.style;
  root.setProperty('--bg', options.bg ?? '#000');
  root.setProperty('--fg', theme.text);
  root.setProperty('--accent', theme.accent);
  root.setProperty('--dim', theme.dim);
  root.setProperty('--line', `color-mix(in srgb, ${theme.accent} 25%, transparent)`);
  root.setProperty('--panel', `color-mix(in srgb, ${options.bg ?? '#000'} 85%, transparent)`);
  root.colorScheme = theme.light ? 'light' : 'dark';
}

function syncForm(s: State): void {
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    const k = el.name as keyof State;
    if (!(k in s)) continue;
    const shown = k === 'glow' || k === 'cellBackground' ? Number(toOptions(s)[k]) : s[k];
    if (el.type === 'checkbox') el.checked = Boolean(shown);
    else el.value = String(shown);
    const out = form.elements.namedItem(`${k}Out`) as HTMLOutputElement | null;
    if (out) out.value = String(shown);
  }
  sceneLabel.textContent = s.scene === 'media' ? 'dropped-file' : s.scene;
}

const rummy = new Rummy(canvas, { ...toOptions(state), intro: 'type' });
if (state.paused) rummy.pause();
applyLook(state.look);
syncForm(state);

function update(next: State): void {
  const sceneChanged = next.scene !== state.scene;
  state = next;
  // New scenes arrive by transition; everything else changes in place.
  if (sceneChanged) void rummy.transition(toOptions(state), { style: 'decode' });
  else rummy.set(toOptions(state));
  if (state.paused) rummy.pause();
  else rummy.play();
  applyLook(state.look);
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
