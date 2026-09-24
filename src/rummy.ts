import { buildAtlas, normalizeCharset, type Atlas, type FontSpec } from './atlas';
import {
  createProgram,
  createTarget,
  createTexture,
  deleteTarget,
  oklab,
  parseColor,
  type Program,
  type Target,
} from './gl';
import {
  COMPOSITE_FS,
  EXPOSURE_FS,
  FULLSCREEN_VS,
  GLOW_FS,
  GLYPH_FS,
  LUMA_FS,
  MIX_FS,
  PERSIST_FS,
  SCENE_MAIN,
  SCENE_PRELUDE,
  SOURCE_SCENE,
} from './shaders';
import { ascii } from './charsets';
import { ring } from './scenes';
import type { GpuTimer, GpuTimes } from './timer';

/** GLSL defining `vec4 scene(vec2 uv)`, or any image/video/canvas to asciify. */
export type SceneInput = string | TexImageSource;

/**
 * A value for a scene's own uniform: number → float, boolean → bool,
 * 2–4 numbers → vec2–vec4, an image/video/canvas → sampler2D.
 */
export type UniformValue = number | boolean | readonly number[] | TexImageSource;

export type TransitionStyle = 'decode' | 'wipe' | 'rain';

export interface TransitionOptions {
  /** How cells change over. Default `decode`. */
  style: TransitionStyle;
  /** Milliseconds. Default 900. */
  duration: number;
}

interface Transition {
  from: Target;
  mix: Target;
  style: number;
  elapsed: number;
  duration: number;
  resolve: () => void;
}

const STYLES: Record<TransitionStyle | 'dissolve', number> = { decode: 0, wipe: 1, rain: 2, dissolve: 3 };

export type IntroStyle = 'type' | 'scan' | 'boot';
const INTROS: Record<IntroStyle, number> = { type: 5, scan: 6, boot: 7 };
const INTRO_MS = 800;

export interface PointerEffects {
  /** Rings spreading from the pointer's path, 0..1. */
  ripple: number;
  /** A 2x magnifier under the pointer, 0..1. */
  lens: number;
  /** Lens radius, as a share of the canvas height. */
  lensRadius: number;
  /** One expanding ring on click or tap, 0..1. */
  shockwave: number;
}

export interface CrtOptions {
  /** Barrel distortion, 0..1. */
  curvature: number;
  /** Corner darkening, 0..1. */
  vignette: number;
  /** Aperture-grille RGB mask, 0..1. */
  mask: number;
  /** Red/blue offset in CSS px. */
  fringe: number;
  /** Brightness flicker, 0..1. Off under reduced motion. */
  flicker: number;
}

export interface RummyOptions {
  /** GLSL scene snippet or a texture source. Default: the `ring` scene. */
  scene: SceneInput;
  /** CSS pixels. */
  fontSize: number;
  fontFamily: string;
  fontWeight: string | number;
  /** Cell height as a multiple of fontSize. */
  lineHeight: number;
  /** Glyphs to choose from. A space is always included. */
  charset: string;
  /** `shape` matches glyph silhouettes; `density` is the classic brightness ramp. */
  mode: 'shape' | 'density';
  /** Glyph colour when `colorMix` is 0. Any CSS colour. */
  fg: string;
  /** Background. Any CSS colour, including `transparent`. */
  bg: string;
  /** 0 = monochrome `fg`, 1 = full scene colour. */
  colorMix: number;
  /** Quantize cell colours to these (any CSS colours, up to 32). See `palettes`. */
  palette: readonly string[] | null;
  /** Ordered dither across cells when quantizing, 0..1 (1 spans the gap between neighbouring palette colours). */
  dither: number;
  /** Two-tone cells: the darker part of each cell becomes its background, 0..1. */
  cellBackground: number;
  /** Brightness multiplier before glyph matching. */
  gain: number;
  gamma: number;
  /**
   * Exposure multiplier, or `auto` to adapt to the frame. `source` (default) is
   * auto for images, video and canvases and 1 for GLSL scenes, which are tuned
   * by hand.
   */
  exposure: number | 'auto' | 'source';
  /** Exponent sharpening contrast inside a cell (1 = off). */
  contrast: number;
  /** Exponent sharpening contrast against neighbouring cells (1 = off). */
  directionalContrast: number;
  /** Depth-silhouette strength, 0..1. */
  edges: number;
  edgeThreshold: number;
  /**
   * Temporal anti-aliasing, 0..1. Still frames refine over 16 jittered frames.
   * In motion there is no jitter (it made sub-cell detail flicker) and this sets
   * how much of the last frame is kept. 0 = one point sample per region.
   */
  antialias: number;
  /** Supersampling per region: 1 (fast) or 2 (smoother). */
  quality: 1 | 2;
  /**
   * Phosphor persistence, 0..1: bright glyphs linger and fade as the scene
   * moves on. The share of brightness kept per 1/60 s, so trails are the same
   * length at any frame rate. Off under prefers-reduced-motion.
   */
  persistence: number;
  /** Phosphor glow around bright glyphs, 0..1. Computed at cell resolution. */
  glow: number;
  /** Glow radius in cells. */
  glowRadius: number;
  /** Darken every other device pixel row, 0..1. */
  scanlines: number;
  /** CRT screen effects. `true` for a tasteful preset. */
  crt: boolean | Partial<CrtOptions>;
  /** Device pixel ratio cap. */
  maxDpr: number;
  /** 0 = uncapped. */
  maxFps: number;
  timeScale: number;
  /** Track the pointer and feed it to scenes as uMouse. */
  mouse: boolean;
  /**
   * Pointer effects that work on any scene, by bending where cells sample it.
   * `true` for a gentle preset. Touch works (a tap is a click). Off under
   * prefers-reduced-motion.
   */
  pointer: boolean | Partial<PointerEffects>;
  /**
   * Feed page scroll to scenes as uScroll: 0 while the canvas top is at the
   * viewport top, 1 once it has scrolled out. `false` holds it at 0; a number
   * drives it yourself (a scrubber, a scroll timeline of your own). Held at 0
   * under prefers-reduced-motion, since scroll-linked motion is a common trigger.
   */
  scroll: boolean | number;
  /** Shift the scene's focal point, in screen() units (y spans -1..1). */
  offset: [number, number];
  /**
   * How the first frames arrive: `type` fills in reading order behind a cursor,
   * `scan` sweeps a line down, `boot` powers cells up at random. Never delays
   * the first paint; skipped under prefers-reduced-motion.
   */
  intro: IntroStyle | false;
  /** Stop rendering while the canvas is off screen. */
  pauseOffscreen: boolean;
  /** Honour prefers-reduced-motion by rendering a still frame. */
  respectReducedMotion: boolean;
  /** Measure GPU time per pass into `stats.gpu` (where the browser allows). */
  profile: boolean;
  /**
   * Shed detail before dropping frames. When frames run late the governor
   * steps down, in order: lower scene detail (uDetail), a 30 fps cap, lower
   * detail again. It probes back up when there is room. `stats.level` says
   * where it is (0 = full).
   */
  adaptive: boolean;
  /**
   * Values for uniforms the scene declares itself (`uniform float uSpeed;`).
   * `set({ uniforms })` merges into the current ones and never recompiles.
   */
  uniforms: Readonly<Record<string, UniformValue>>;
}


export const crtPreset: CrtOptions = { curvature: 0.5, vignette: 0.6, mask: 0.2, fringe: 0.75, flicker: 0.25 };
const noCrt: CrtOptions = { curvature: 0, vignette: 0, mask: 0, fringe: 0, flicker: 0 };
export const pointerPreset: PointerEffects = { ripple: 0.6, lens: 0, lensRadius: 0.22, shockwave: 0.8 };
const noPointer: PointerEffects = { ripple: 0, lens: 0, lensRadius: 0.22, shockwave: 0 };
/** How long pointer effects keep animating after the last movement, in ms. */
const POINTER_FADE_MS = 2500;

export const defaults: RummyOptions = {
  scene: ring,
  fontSize: 12,
  fontFamily: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontWeight: 500,
  lineHeight: 1.25,
  charset: ascii,
  mode: 'shape',
  fg: '#9dffb0',
  bg: '#050805',
  colorMix: 0,
  palette: null,
  dither: 1,
  cellBackground: 0,
  gain: 0.85,
  gamma: 1.15,
  exposure: 'source',
  contrast: 1.6,
  directionalContrast: 2.0,
  edges: 0.6,
  edgeThreshold: 0.08,
  antialias: 0.6,
  quality: 1,
  persistence: 0,
  glow: 0,
  glowRadius: 2.5,
  scanlines: 0,
  crt: false,
  maxDpr: 2,
  maxFps: 0,
  timeScale: 1,
  mouse: true,
  pointer: false,
  scroll: true,
  offset: [0, 0],
  intro: false,
  pauseOffscreen: true,
  respectReducedMotion: true,
  profile: false,
  adaptive: true,
  uniforms: {},
};

export interface RummyStats {
  columns: number;
  rows: number;
  /** Scene samples shaded per frame. */
  samples: number;
  /** Canvas size in device pixels. */
  width: number;
  height: number;
  fps: number;
  /** GPU milliseconds per pass, when `profile` is on and the browser supports timer queries. */
  gpu: GpuTimes | null;
  /** Current exposure multiplier, when `profile` is on (read back each frame, so profiling only). */
  exposure: number | null;
  /** Frame-time governor level: 0 = full detail, 3 = the most shed. */
  level: number;
}

const isSource = (s: SceneInput): s is TexImageSource => typeof s !== 'string';

function sourceSize(s: TexImageSource): [number, number] {
  if (typeof HTMLVideoElement !== 'undefined' && s instanceof HTMLVideoElement) return [s.videoWidth, s.videoHeight];
  if (typeof HTMLImageElement !== 'undefined' && s instanceof HTMLImageElement) return [s.naturalWidth, s.naturalHeight];
  if (typeof VideoFrame !== 'undefined' && s instanceof VideoFrame) return [s.displayWidth, s.displayHeight];
  const sized = s as { width: number; height: number };
  return [sized.width, sized.height];
}

function isStatic(s: TexImageSource): boolean {
  return (
    (typeof HTMLImageElement !== 'undefined' && s instanceof HTMLImageElement) ||
    (typeof ImageBitmap !== 'undefined' && s instanceof ImageBitmap) ||
    (typeof ImageData !== 'undefined' && s instanceof ImageData)
  );
}

/** A scene's declared still moment: `#define STILL 5.0` in its GLSL, else 0. */
function stillOf(scene: SceneInput): number {
  if (typeof scene !== 'string') return 0;
  const m = /#define\s+STILL\s+(-?[\d.]+)/.exec(scene);
  return m ? Number(m[1]) : 0;
}

/** Governor levels, in the order detail is shed: scene detail, then frame rate. */
// Ordered by what was measured to pay (pnpm measure, SwiftShader): 2x
// supersampling back to 1x more than doubles the frame rate under load, glow is
// worth ~10%, scene detail matters for raymarch-heavy scenes, and the 30 fps cap
// is the last resort because it is the most visible.
const LEVELS = [
  { detail: 1, singleSample: false, glow: true, fps: 0 },
  { detail: 0.6, singleSample: true, glow: true, fps: 0 },
  { detail: 0.35, singleSample: true, glow: false, fps: 0 },
  { detail: 0.35, singleSample: true, glow: false, fps: 30 },
];

/** Frames a still image refines over before the loop goes idle. */
const REFINE_FRAMES = 16;

/** R2 low-discrepancy sequence, centred: frame 0 samples the region centre. */
function jitter(frame: number): [number, number] {
  if (frame === 0) return [0, 0];
  return [((0.5 + frame * 0.7548776662) % 1) - 0.5, ((0.5 + frame * 0.569840291) % 1) - 0.5];
}

/**
 * Renders a 3D (or any) scene as ASCII into a canvas.
 *
 *   const r = new Rummy(canvas, { scene: scenes.terrain, fg: '#ffb000' });
 *   r.set({ fontSize: 16 });
 *   r.destroy();
 */
export class Rummy {
  /**
   * The moment a scene declares as its still (`#define STILL 5.0`), or 0.
   * Rummy starts scenes there and holds it under prefers-reduced-motion.
   */
  static stillOf = stillOf;

  readonly canvas: HTMLCanvasElement;
  readonly stats: RummyStats = { columns: 0, rows: 0, samples: 0, width: 0, height: 0, fps: 0, gpu: null, exposure: null, level: 0 };

  private opts: RummyOptions;
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject | null = null;
  private programs: Record<'scene' | 'luma' | 'exposure' | 'glyph' | 'glow' | 'composite' | 'mix' | 'persist', Program> | null = null;
  /** Afterglow grids, ping-ponged; allocated only while persistence is on. */
  private persistTargets: [Target, Target] | null = null;
  private persistIndex = 0;
  private persistFresh = true;
  /** The grid the last frame displayed: live, transition mix, or afterglow. */
  private shown: Target | null = null;
  private transitionState: Transition | null = null;
  /** True while transition() applies its own options through set(). */
  private transitioning = false;
  /** The intro still has to run (once, on the first frame). */
  private introPending = true;
  /** The inkiest glyph in the charset: the typing cursor. */
  private cursorIndex = 0;
  private sceneTargets: [Target, Target] | null = null;
  private sceneIndex = 0;
  private lumaTarget: Target | null = null;
  private exposureTargets: [Target, Target] | null = null;
  private exposureIndex = 0;
  private glyphTarget: Target | null = null;
  private stepping = false;
  // Frame-time governor state.
  private level = 0;
  private period = 1000 / 60;   // the display's frame period, learned from the fastest frames
  private interval = 1000 / 60; // smoothed interval between drawn frames
  private lateFor = 0;          // seconds frames have been running late
  private fineFor = 0;          // seconds frames have been on time
  private probeWait = 4;        // seconds of on-time frames before trying a higher level
  private probedAt = -1;        // governor time of the last step up, to catch probes that fail
  private governed = 0;         // seconds of drawn motion, the governor's own clock
  private glowTargets: [Target, Target] | null = null;
  private atlas: Atlas | null = null;
  private atlasTex: WebGLTexture | null = null;
  private shapesTex: WebGLTexture | null = null;
  private sourceTex: WebGLTexture | null = null;
  private sourceUploaded = false;
  /** Textures for sampler uniforms, by uniform name. */
  private uniformTextures = new Map<string, { tex: WebGLTexture; source: TexImageSource | null }>();
  private warnedUniforms = new Set<string>();
  private timer: GpuTimer | null = null;
  private paletteLab = new Float32Array(32 * 3);
  private paletteRgb = new Float32Array(32 * 3);
  private paletteSize = 0;
  /** Typical distance between neighbouring palette colours: the dither's reach. */
  private paletteSpread = 0;

  private dpr = 1;
  private raf = 0;
  private clock = 0;
  private last = -1;
  private dt = 0;
  private lastDrawn = -Infinity;
  private fpsFrames = 0;
  private fpsStart = 0;
  private accumFrame = 0;
  private exposureFresh = true;
  private mouse: [number, number] = [0, 0];
  private mouseTarget: [number, number] = [0, 0];
  private scroll = 0;
  // Pointer effects: recent positions (uv, y up) with timestamps, a shockwave, the lens.
  private trail: { u: number; v: number; t: number }[] = [];
  private shock: { u: number; v: number; t: number } | null = null;
  private pointerUv: [number, number] | null = null;
  private pointerAt = -Infinity;
  /** Effects clock, in seconds: advances with each drawn frame, so step() is deterministic. */
  private fxTime = 0;
  private onscreen = true;
  private playing = true;
  private dirty = true;
  private reducedMotion = false;
  private lost = false;
  private destroyed = false;
  private fontEpoch = 0;

  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver | null = null;
  private motionQuery: MediaQueryList | null = null;

  constructor(canvas: HTMLCanvasElement, options: Partial<RummyOptions> = {}) {
    this.canvas = canvas;
    this.opts = { ...defaults, ...options };
    this.clock = stillOf(this.opts.scene);
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    if (!gl) throw new Error('rummy: WebGL2 is not available');
    this.gl = gl;

    this.init();

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(canvas);

    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        this.onscreen = entry.isIntersecting;
        this.schedule();
      });
      this.intersectionObserver.observe(canvas);
    }

    if (typeof matchMedia !== 'undefined') {
      this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = this.motionQuery.matches;
      this.motionQuery.addEventListener('change', this.onMotionChange);
    }

    window.addEventListener('pointermove', this.onPointer, { passive: true });
    window.addEventListener('pointerdown', this.onPointer, { passive: true });
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.watchFont();
    this.schedule();
  }

  /** Supersampling in effect: the option, unless the governor has shed it. */
  private get quality(): 1 | 2 {
    return this.opts.adaptive && LEVELS[this.level].singleSample ? 1 : this.opts.quality;
  }

  /** Current options (a copy). */
  get options(): RummyOptions {
    return { ...this.opts };
  }

  /** Scene time in seconds. Setting it jumps the animation (and restarts refinement). */
  get time(): number {
    return this.clock;
  }

  set time(t: number) {
    this.clock = t;
    this.invalidate();
  }

  /** Update any options. Cheap for uniforms; font/charset changes rebuild the atlas. */
  set(options: Partial<RummyOptions>): void {
    const prev = this.opts;
    this.opts = { ...prev, ...options };
    // Uniforms merge, so one value can change without restating the rest.
    if (options.uniforms) this.opts.uniforms = { ...prev.uniforms, ...options.uniforms };
    const changed = (k: keyof RummyOptions) => k in options && options[k] !== prev[k];

    if (this.lost) return;
    // A plain scene change is a cut: it ends any transition in progress.
    if (changed('scene') && this.transitionState && !this.transitioning) this.endTransition();
    if (changed('scene')) {
      this.compileScene();
      this.exposureFresh = true;
      this.clock = stillOf(this.opts.scene);
    }
    if (changed('palette')) this.buildPalette();
    if (changed('profile')) this.setupTimer();
    if (
      changed('fontSize') ||
      changed('fontFamily') ||
      changed('fontWeight') ||
      changed('lineHeight') ||
      changed('charset') ||
      changed('maxDpr')
    ) {
      this.layout(true);
      if (changed('fontFamily') || changed('fontWeight')) this.watchFont();
    } else if (changed('quality')) {
      this.allocateTargets();
    }
    this.invalidate();
  }

  /**
   * Re-measure the canvas now. Layout changes are picked up automatically by a
   * ResizeObserver; call this when you need the new size this frame.
   */
  resize(): void {
    this.layout();
  }

  /**
   * Change options (usually the scene) with an animated handover instead of a
   * cut. The outgoing frame is held and each cell switches over at its own
   * moment, through a brief scramble of random glyphs. Resolves when done.
   * Calling it again mid-transition starts from what is on screen. Under
   * prefers-reduced-motion it is a short dissolve with no scramble.
   *
   *   await rummy.transition({ scene: scenes.globe }, { style: 'rain' });
   */
  transition(options: Partial<RummyOptions>, { style = 'decode', duration = 900 }: Partial<TransitionOptions> = {}): Promise<void> {
    if (this.lost || this.destroyed || !this.glyphTarget) {
      this.set(options);
      return Promise.resolve();
    }
    const gl = this.gl;
    const grid = this.glyphTarget;
    const calm = this.opts.respectReducedMotion && this.reducedMotion;
    const previous = this.transitionState;
    // Hold what is on screen now: the live grid, or the current mix.
    const from = previous?.from ?? createTarget(gl, grid.width, grid.height, { attachments: 2 });
    const mix = previous?.mix ?? createTarget(gl, grid.width, grid.height, { attachments: 2 });
    this.copyGrid(previous ? mix : grid, from);
    previous?.resolve();

    return new Promise((resolve) => {
      this.transitionState = {
        from,
        mix,
        style: STYLES[calm ? 'dissolve' : style],
        elapsed: 0,
        duration: Math.max(1, calm ? Math.min(duration, 250) : duration),
        resolve,
      };
      this.transitioning = true;
      this.set(options);
      this.transitioning = false;
    });
  }

  play(): void {
    this.playing = true;
    this.schedule();
  }

  pause(): void {
    this.playing = false;
  }

  /**
   * Render one frame now, regardless of play state. Still frames refine with
   * each call (up to 16), so call it repeatedly for a fully anti-aliased still.
   */
  render(): void {
    if (this.lost || this.destroyed || !this.atlas) return;
    this.draw();
  }

  /**
   * Advance the clock by `seconds` and render one frame exactly as the running
   * loop would, with motion's temporal behaviour. For recording
   * frames and for tests that need identical timing across instances.
   */
  step(seconds = 1 / 60): void {
    if (this.lost || this.destroyed || !this.atlas) return;
    this.stepping = true;
    this.dt = seconds;
    this.clock += seconds;
    this.draw();
    this.stepping = false;
  }

  /**
   * The last rendered frame as text: one line per row, top first, including
   * the partly visible bottom row. Reads back the glyph grid (a few thousand
   * cells, not the canvas), so it is cheap enough to call on demand.
   */
  toText(): string {
    if (this.lost || this.destroyed || !this.glyphTarget || !this.atlas) return '';
    const gl = this.gl;
    const { width, height, fb } = this.shown ?? this.glyphTarget;
    const px = new Uint8Array(width * height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const { chars } = this.atlas;
    const lines: string[] = [];
    for (let y = height - 1; y >= 0; y--) {
      let line = '';
      for (let x = 0; x < width; x++) line += chars[px[(y * width + x) * 4]] ?? ' ';
      lines.push(line);
    }
    return lines.join('\n');
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver?.disconnect();
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    window.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('pointerdown', this.onPointer);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.release();
  }

  // --- lifecycle -----------------------------------------------------------

  private init(): void {
    const gl = this.gl;
    this.vao = gl.createVertexArray();
    this.programs = {
      scene: this.buildSceneProgram(),
      luma: createProgram(gl, FULLSCREEN_VS, LUMA_FS),
      exposure: createProgram(gl, FULLSCREEN_VS, EXPOSURE_FS),
      glyph: createProgram(gl, FULLSCREEN_VS, GLYPH_FS),
      glow: createProgram(gl, FULLSCREEN_VS, GLOW_FS),
      composite: createProgram(gl, FULLSCREEN_VS, COMPOSITE_FS),
      mix: createProgram(gl, FULLSCREEN_VS, MIX_FS),
      persist: createProgram(gl, FULLSCREEN_VS, PERSIST_FS),
    };
    this.prepareSource();
    this.exposureTargets = [createTarget(gl, 1, 1), createTarget(gl, 1, 1)];
    this.exposureFresh = true;
    this.buildPalette();
    this.setupTimer();
    this.layout(true);
  }

  private release(): void {
    const gl = this.gl;
    if (this.transitionState && !gl.isContextLost()) this.endTransition();
    this.transitionState?.resolve();
    this.transitionState = null;
    this.timer?.dispose();
    this.timer = null;
    if (gl.isContextLost()) return;
    for (const p of Object.values(this.programs ?? {})) gl.deleteProgram(p.program);
    for (const t of [this.atlasTex, this.shapesTex, this.sourceTex]) if (t) gl.deleteTexture(t);
    for (const { tex } of this.uniformTextures.values()) gl.deleteTexture(tex);
    this.uniformTextures.clear();
    for (const t of [
      ...(this.sceneTargets ?? []),
      ...(this.exposureTargets ?? []),
      ...(this.glowTargets ?? []),
      this.glyphTarget,
      this.lumaTarget,
      ...(this.persistTargets ?? []),
    ]) {
      deleteTarget(gl, t);
    }
    gl.deleteVertexArray(this.vao);
    this.programs = null;
    this.atlasTex = this.shapesTex = this.sourceTex = null;
    this.sceneTargets = this.exposureTargets = this.glowTargets = null;
    this.lumaTarget = this.glyphTarget = null;
    this.persistTargets = null;
    this.shown = null;
  }

  /**
   * Profiling is a development tool, so its code is a separate chunk loaded on
   * first use rather than something every production page ships.
   */
  private setupTimer(): void {
    if (this.opts.profile && !this.timer) {
      void import('./timer').then(({ GpuTimer }) => {
        if (!this.opts.profile || this.timer || this.destroyed || this.lost) return;
        const timer = new GpuTimer(this.gl);
        if (!timer.supported) return;
        this.timer = timer;
        this.stats.gpu = timer.times;
      });
    } else if (!this.opts.profile && this.timer) {
      this.timer.dispose();
      this.timer = null;
      this.stats.gpu = null;
    }
  }

  private buildSceneProgram(): Program {
    const { scene } = this.opts;
    const body = isSource(scene) ? SOURCE_SCENE : scene;
    // Newlines matter: a scene may open with a preprocessor line (#define STILL).
    return createProgram(this.gl, FULLSCREEN_VS, `${SCENE_PRELUDE}\n${body}\n${SCENE_MAIN}`);
  }

  private compileScene(): void {
    const next = this.buildSceneProgram();
    if (this.programs) {
      this.gl.deleteProgram(this.programs.scene.program);
      this.programs.scene = next;
    }
    this.prepareSource();
  }

  private prepareSource(): void {
    const gl = this.gl;
    const { scene } = this.opts;
    if (isSource(scene)) {
      if (!this.sourceTex) {
        this.sourceTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      this.sourceUploaded = false;
    }
  }

  private buildPalette(): void {
    const colors = (this.opts.palette ?? []).slice(0, 32);
    this.paletteSize = colors.length;
    const rgbs = colors.map((css) => parseColor(css).slice(0, 3));
    rgbs.forEach((rgb, i) => {
      this.paletteRgb.set(rgb, i * 3);
      this.paletteLab.set(oklab(rgb), i * 3);
    });
    // Ordered dither only bridges two colours if it can reach from one to the
    // other, so its amplitude follows the palette's spacing: the mean distance
    // from each colour to its nearest neighbour, per channel.
    const nearest = rgbs.map((a, i) =>
      Math.min(...rgbs.filter((_, j) => j !== i).map((b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / Math.sqrt(3))),
    );
    this.paletteSpread = nearest.length > 1 ? nearest.reduce((x, y) => x + y, 0) / nearest.length : 0;
  }

  private fontSpec(): FontSpec {
    return {
      family: this.opts.fontFamily,
      weight: this.opts.fontWeight,
      size: Math.max(4, Math.round(this.opts.fontSize * this.dpr)),
      lineHeight: this.opts.lineHeight,
    };
  }

  private buildGlyphs(): void {
    const gl = this.gl;
    const atlas = buildAtlas(normalizeCharset(this.opts.charset), this.fontSpec());
    this.atlas = atlas;
    let best = 0;
    for (let i = 1; i < atlas.chars.length; i++) {
      if (atlas.shapes[(atlas.chars.length + i) * 4 + 2] > atlas.shapes[(atlas.chars.length + best) * 4 + 2]) best = i;
    }
    this.cursorIndex = best;

    if (this.atlasTex) gl.deleteTexture(this.atlasTex);
    this.atlasTex = createTexture(gl, {
      width: atlas.canvas.width,
      height: atlas.canvas.height,
      internalFormat: gl.R8,
      format: gl.RED,
      type: gl.UNSIGNED_BYTE,
    });
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, atlas.canvas);

    if (this.shapesTex) gl.deleteTexture(this.shapesTex);
    this.shapesTex = createTexture(gl, {
      width: atlas.chars.length,
      height: 2,
      internalFormat: gl.RGBA32F,
      format: gl.RGBA,
      type: gl.FLOAT,
      data: atlas.shapes,
    });
  }

  /** Rebuild the atlas once a web font actually arrives. */
  private watchFont(): void {
    if (typeof document === 'undefined' || !document.fonts) return;
    const epoch = ++this.fontEpoch;
    const spec = `${this.opts.fontWeight} ${this.opts.fontSize}px ${this.opts.fontFamily}`;
    document.fonts
      .load(spec)
      .then((faces) => {
        if (faces.length && epoch === this.fontEpoch && !this.destroyed && !this.lost) this.layout(true);
      })
      .catch(() => {});
  }

  private layout(rebuildGlyphs = false): void {
    if (this.lost || this.destroyed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (dpr !== this.dpr) rebuildGlyphs = true;
    this.dpr = dpr;
    if (rebuildGlyphs || !this.atlas) this.buildGlyphs();
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.allocateTargets();
    this.invalidate();
  }

  private allocateTargets(): void {
    const atlas = this.atlas!;
    const columns = Math.ceil(this.canvas.width / atlas.cellWidth);
    const rows = Math.ceil(this.canvas.height / atlas.cellHeight);
    const q = this.quality;
    const gl = this.gl;

    if (this.glyphTarget?.width !== columns || this.glyphTarget?.height !== rows) {
      deleteTarget(gl, this.glyphTarget);
      deleteTarget(gl, this.lumaTarget);
      for (const t of this.persistTargets ?? []) deleteTarget(gl, t);
      this.persistTargets = null;
      this.shown = null;
      for (const t of this.glowTargets ?? []) deleteTarget(gl, t);
      this.glyphTarget = createTarget(gl, columns, rows, { attachments: 2 });
      this.lumaTarget = createTarget(gl, columns, rows, { mipmaps: true });
      this.glowTargets = [
        createTarget(gl, columns, rows, { filter: gl.LINEAR }),
        createTarget(gl, columns, rows, { filter: gl.LINEAR }),
      ];
    }
    const sw = columns * 2 * q;
    const sh = rows * 3 * q;
    if (this.sceneTargets?.[0].width !== sw || this.sceneTargets?.[0].height !== sh) {
      for (const t of this.sceneTargets ?? []) deleteTarget(gl, t);
      this.sceneTargets = [createTarget(gl, sw, sh), createTarget(gl, sw, sh)];
    }

    Object.assign(this.stats, {
      columns,
      rows,
      samples: sw * sh,
      width: this.canvas.width,
      height: this.canvas.height,
    });
    this.invalidate();
  }

  /** Something changed: redraw, and restart temporal refinement from scratch. */
  private invalidate(): void {
    this.dirty = true;
    this.accumFrame = 0;
    this.persistFresh = true;
    this.schedule();
  }

  // --- frame loop ----------------------------------------------------------

  private get animating(): boolean {
    return this.playing && !(this.opts.respectReducedMotion && this.reducedMotion);
  }

  private get moving(): boolean {
    return (
      this.animating ||
      this.stepping ||
      this.transitionState !== null ||
      this.sourceIsLive() ||
      (this.pointerEffects() !== null && performance.now() - this.pointerAt < POINTER_FADE_MS)
    );
  }

  private get refining(): boolean {
    return !this.moving && this.opts.antialias > 0 && this.accumFrame < REFINE_FRAMES;
  }

  private schedule(): void {
    if (this.raf || this.destroyed || this.lost) return;
    if (this.opts.pauseOffscreen && !this.onscreen) return;
    if (!this.moving && !this.dirty && !this.refining) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private sourceIsLive(): boolean {
    const s = this.opts.scene;
    return this.playing && isSource(s) && !isStatic(s);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const dt = this.last < 0 ? 0 : Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.dt = dt;
    if (this.animating) this.clock += dt * this.opts.timeScale;

    const k = 1 - Math.exp(-dt * 5);
    this.mouse[0] += (this.mouseTarget[0] - this.mouse[0]) * k;
    this.mouse[1] += (this.mouseTarget[1] - this.mouse[1]) * k;
    this.scroll += (this.scrollTarget() - this.scroll) * k;

    const caps = [this.opts.maxFps, this.opts.adaptive ? LEVELS[this.level].fps : 0].filter((f) => f > 0);
    const interval = caps.length ? 1000 / Math.min(...caps) : 0;
    const due = now - this.lastDrawn >= interval - 1;
    if ((this.moving || this.dirty || this.refining) && due) {
      if (this.moving && this.lastDrawn > 0) this.govern(now - this.lastDrawn, interval);
      this.lastDrawn = now;
      this.draw();
      this.fpsFrames++;
      if (now - this.fpsStart >= 500) {
        this.stats.fps = (this.fpsFrames * 1000) / (now - this.fpsStart);
        this.fpsFrames = 0;
        this.fpsStart = now;
      }
    }
    if (!this.moving) this.last = -1;
    this.schedule();
  };

  /**
   * The frame-time governor. Frames are late when they take noticeably longer
   * than the target (the display period, or the level's cap). A second of late
   * frames steps down a level; four on-time seconds probe a level up, and a
   * probe that fails within two seconds doubles the wait before the next one.
   */
  private govern(elapsed: number, cap: number): void {
    if (!this.opts.adaptive) {
      this.level = this.stats.level = 0;
      return;
    }
    const dt = Math.min(elapsed, 250) / 1000;
    this.governed += dt;
    // The display period is the fastest interval seen, drifting up very slowly
    // so a monitor change is eventually noticed but slow frames never become
    // the new normal.
    this.period = Math.max(5, Math.min(this.period * 1.001, elapsed));
    this.interval += (elapsed - this.interval) * 0.1;
    const target = Math.max(this.period, cap);
    if (this.interval > target * 1.3) {
      this.lateFor += dt;
      this.fineFor = 0;
    } else {
      this.fineFor += dt;
      this.lateFor = Math.max(0, this.lateFor - dt);
    }
    if (this.lateFor > 1 && this.level < LEVELS.length - 1) {
      // A probe that failed quickly: wait longer before the next one.
      if (this.probedAt >= 0 && this.governed - this.probedAt < 2) this.probeWait = Math.min(this.probeWait * 2, 60);
      this.level++;
      this.lateFor = this.fineFor = 0;
      this.interval = target;
      this.probedAt = -1;
    } else if (this.fineFor > this.probeWait && this.level > 0) {
      this.level--;
      this.fineFor = 0;
      this.probedAt = this.governed;
      this.interval = target;
    }
    if (this.stats.level !== this.level) {
      const before = this.sceneTargets?.[0].width;
      this.stats.level = this.level;
      // Shedding supersampling changes the scene target's size.
      if (this.atlas && before !== undefined && before !== (this.glyphTarget?.width ?? 0) * 2 * this.quality) {
        this.allocateTargets();
      }
    }
  }

  /** Pointer-effect uniforms for the glyph pass (uWarp = 0 when nothing is active). */
  private applyPointer(gp: Program, aspect: number, grid: Target): void {
    const gl = this.gl;
    const fx = this.pointerEffects();
    this.fxTime += this.dt;
    const now = this.fxTime;
    let warp = 0;
    if (fx) {
      const trail = new Float32Array(8 * 3).fill(-1);
      if (fx.ripple > 0) {
        this.trail = this.trail.filter((p) => now - p.t < POINTER_FADE_MS / 1000);
        this.trail.forEach((p, i) => trail.set([p.u, p.v, now - p.t], i * 3));
        if (this.trail.length) warp |= 1;
      }
      gl.uniform3fv(gp.u.uTrail, trail);
      gl.uniform1f(gp.u.uRipple, fx.ripple);
      if (fx.lens > 0 && this.pointerUv) {
        warp |= 2;
        gl.uniform4f(gp.u.uLens, this.pointerUv[0], this.pointerUv[1], fx.lensRadius, fx.lens);
      }
      const shockAge = this.shock ? now - this.shock.t : -1;
      if (fx.shockwave > 0 && this.shock && shockAge < 2) {
        warp |= 4;
        gl.uniform4f(gp.u.uShock, this.shock.u, this.shock.v, shockAge, fx.shockwave);
      }
    }
    gl.uniform1i(gp.u.uWarp, warp);
    gl.uniform2f(gp.u.uRegions, grid.width * 2, grid.height * 3);
    gl.uniform1f(gp.u.uGridAspect, aspect);
  }

  /** Where uScroll is heading: one layout read, only from the running loop. */
  private scrollTarget(): number {
    const { scroll, respectReducedMotion } = this.opts;
    if (scroll === false || typeof scroll === 'number' || (respectReducedMotion && this.reducedMotion)) return 0;
    const r = this.canvas.getBoundingClientRect();
    return r.height > 0 ? Math.min(1, Math.max(0, -r.top / r.height)) : 0;
  }

  private resolvedCrt(): CrtOptions {
    const { crt } = this.opts;
    if (crt === true) return crtPreset;
    if (!crt) return noCrt;
    return { ...noCrt, ...crt };
  }

  private autoExposure(): boolean {
    const { exposure, scene } = this.opts;
    return exposure === 'auto' || (exposure === 'source' && isSource(scene));
  }

  private pass(target: Target | null, program: Program): void {
    const gl = this.gl;
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
      gl.viewport(0, 0, target.width, target.height);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    gl.useProgram(program.program);
  }

  private bind(unit: number, tex: WebGLTexture | null, location: WebGLUniformLocation | undefined): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (location) gl.uniform1i(location, unit);
  }

  private draw(): void {
    const gl = this.gl;
    const atlas = this.atlas!;
    const programs = this.programs!;
    const glyphs = this.glyphTarget!;
    const o = this.opts;
    const timer = this.timer;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);

    // 1. Scene: one jittered sample per region, folded into the history.
    const prev = this.sceneTargets![this.sceneIndex];
    const scene = this.sceneTargets![1 - this.sceneIndex];
    this.sceneIndex = 1 - this.sceneIndex;
    const aa = Math.max(0, Math.min(1, o.antialias));
    const first = this.accumFrame === 0 || aa === 0;
    // Stills refine: jittered samples averaged over 16 frames. In motion there
    // is no jitter, and only a little history. Measured (pnpm measure): jitter in
    // motion made sub-cell features flip between regions frame to frame, which
    // was most of the glyph "boil", and left frames further from the ideal.
    const blend = first ? 1 : this.moving ? 1 - 0.25 * aa : 1 / (Math.min(this.accumFrame, REFINE_FRAMES) + 1);
    const [jx, jy] = aa > 0 && !this.moving ? jitter(this.accumFrame % 64) : [0, 0];
    this.accumFrame++;

    const glow = o.glow > 0 && (!o.adaptive || LEVELS[this.level].glow);
    timer?.beginFrame(glow ? ['scene', 'glyph', 'glow', 'composite'] : ['scene', 'glyph', 'composite']);
    const sp = programs.scene;
    this.pass(scene, sp);
    const aspect = (glyphs.width * atlas.cellWidth) / (glyphs.height * atlas.cellHeight);
    gl.uniform1f(sp.u.uTime, this.clock);
    gl.uniform2f(sp.u.uMouse, this.mouse[0], this.mouse[1]);
    gl.uniform1f(sp.u.uScroll, typeof o.scroll === 'number' ? o.scroll : this.scroll);
    gl.uniform1f(sp.u.uDetail, o.adaptive ? LEVELS[this.level].detail : 1);
    gl.uniform1f(sp.u.uAspect, aspect);
    gl.uniform2f(sp.u.uResolution, scene.width, scene.height);
    gl.uniform2f(sp.u.uOffset, o.offset[0], o.offset[1]);
    gl.uniform1f(sp.u.uBlend, blend);
    gl.uniform2f(sp.u.uJitter, jx, jy);
    this.bind(1, prev.textures[0], sp.u.uPrev);
    if (isSource(o.scene)) this.bindSource(o.scene, sp, aspect);
    this.applyUniforms(sp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    timer?.mark('scene');

    // 2. Exposure, when adaptive: cell luminance -> mips -> eased 1x1 value.
    const auto = this.autoExposure();
    const exposureTargets = this.exposureTargets!;
    if (auto) {
      const lp = programs.luma;
      const luma = this.lumaTarget!;
      this.pass(luma, lp);
      this.bind(0, scene.textures[0], lp.u.uScene);
      gl.uniform1i(lp.u.uQuality, this.quality);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, luma.textures[0]);
      gl.generateMipmap(gl.TEXTURE_2D);

      const ep = programs.exposure;
      const prevE = exposureTargets[this.exposureIndex];
      const nextE = exposureTargets[1 - this.exposureIndex];
      this.exposureIndex = 1 - this.exposureIndex;
      this.pass(nextE, ep);
      this.bind(0, luma.textures[0], ep.u.uLuma);
      this.bind(1, prevE.textures[0], ep.u.uPrevExposure);
      gl.uniform1i(ep.u.uLumaLevel, Math.floor(Math.log2(Math.max(luma.width, luma.height))));
      // Ease while moving so cuts don't pump; snap for stills.
      gl.uniform1f(ep.u.uRate, this.exposureFresh || !this.moving ? 1 : 1 - Math.exp(-this.dt / 0.5));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.exposureFresh = false;
      if (o.profile) {
        const px = new Uint8Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        this.stats.exposure = 2 ** ((px[0] / 255) * 3 - 1);
      }
    } else {
      this.stats.exposure = null;
    }

    // 3. One glyph, glyph colour and background per cell.
    const gp = programs.glyph;
    this.pass(glyphs, gp);
    this.bind(0, scene.textures[0], gp.u.uScene);
    this.bind(1, this.shapesTex, gp.u.uShapes);
    this.bind(2, exposureTargets[this.exposureIndex].textures[0], gp.u.uExposureTex);
    gl.uniform1i(gp.u.uAutoExposure, auto ? 1 : 0);
    gl.uniform1f(gp.u.uExposure, typeof o.exposure === 'number' ? o.exposure : 1);
    gl.uniform1i(gp.u.uCount, atlas.chars.length);
    gl.uniform1i(gp.u.uQuality, this.quality);
    gl.uniform1i(gp.u.uMode, o.mode === 'density' ? 1 : 0);
    gl.uniform1f(gp.u.uGain, o.gain);
    gl.uniform1f(gp.u.uGamma, o.gamma);
    gl.uniform1f(gp.u.uContrast, o.contrast);
    gl.uniform1f(gp.u.uDirContrast, o.directionalContrast);
    gl.uniform1f(gp.u.uEdges, o.edges);
    gl.uniform1f(gp.u.uEdgeThreshold, o.edgeThreshold);
    gl.uniform1f(gp.u.uCellAspect, atlas.cellHeight / atlas.cellWidth);
    this.applyPointer(gp, aspect, glyphs);
    gl.uniform1f(gp.u.uStrokeInk, atlas.strokeInk);
    const fg = parseColor(o.fg);
    const bg = parseColor(o.bg);
    gl.uniform3f(gp.u.uFg, fg[0], fg[1], fg[2]);
    gl.uniform4f(gp.u.uBg, bg[0], bg[1], bg[2], bg[3]);
    gl.uniform1f(gp.u.uColorMix, o.colorMix);
    gl.uniform1f(gp.u.uCellBg, o.cellBackground);
    gl.uniform1i(gp.u.uPaletteSize, this.paletteSize);
    if (this.paletteSize) {
      gl.uniform3fv(gp.u.uPalette, this.paletteLab);
      gl.uniform3fv(gp.u.uPaletteRgb, this.paletteRgb);
    }
    gl.uniform1f(gp.u.uDither, o.dither * this.paletteSpread);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    timer?.mark('glyph');

    // The intro is a transition from a blank screen, started on the first frame.
    if (this.introPending) {
      this.introPending = false;
      const calmIntro = o.respectReducedMotion && this.reducedMotion;
      if (o.intro && !calmIntro && !this.transitionState) {
        const from = createTarget(gl, glyphs.width, glyphs.height, { attachments: 2 });
        const mix = createTarget(gl, glyphs.width, glyphs.height, { attachments: 2 });
        this.transitionState = { from, mix, style: INTROS[o.intro], elapsed: 0, duration: INTRO_MS, resolve: () => {} };
      }
    }

    // 3b. Transition: mix the held grid with this frame's, cell by cell.
    let shown = glyphs;
    const tr = this.transitionState;
    if (tr && tr.style >= INTROS.type && (tr.from.width !== glyphs.width || tr.from.height !== glyphs.height)) {
      // Intros read nothing from the held grid, so a resize mid-intro (a web
      // font arriving after the first frame, typically) just resizes buffers.
      deleteTarget(gl, tr.from);
      deleteTarget(gl, tr.mix);
      tr.from = createTarget(gl, glyphs.width, glyphs.height, { attachments: 2 });
      tr.mix = createTarget(gl, glyphs.width, glyphs.height, { attachments: 2 });
    }
    if (tr && (tr.from.width !== glyphs.width || tr.from.height !== glyphs.height)) {
      this.endTransition(); // the grid was resized; nothing sensible to mix
    } else if (tr) {
      tr.elapsed += this.dt * 1000;
      const mp = programs.mix;
      this.pass(tr.mix, mp);
      this.bind(0, tr.from.textures[0], mp.u.uFromGlyphs);
      this.bind(1, tr.from.textures[1], mp.u.uFromCells);
      this.bind(2, glyphs.textures[0], mp.u.uToGlyphs);
      this.bind(3, glyphs.textures[1], mp.u.uToCells);
      gl.uniform1f(mp.u.uProgress, Math.min(1, tr.elapsed / tr.duration));
      gl.uniform1i(mp.u.uStyle, tr.style);
      gl.uniform1f(mp.u.uTick, Math.floor(tr.elapsed / 50));
      gl.uniform1i(mp.u.uCount, atlas.chars.length);
      gl.uniform2i(mp.u.uGrid, glyphs.width, glyphs.height);
      gl.uniform1i(mp.u.uCursor, this.cursorIndex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      shown = tr.mix;
    }

    // 3c. Persistence: last frame's glyphs linger, fading, where they outshine this one.
    const still = o.respectReducedMotion && this.reducedMotion;
    if (o.persistence > 0 && !still && this.moving) {
      if (!this.persistTargets) {
        this.persistTargets = [
          createTarget(gl, glyphs.width, glyphs.height, { attachments: 2 }),
          createTarget(gl, glyphs.width, glyphs.height, { attachments: 2 }),
        ];
        this.persistFresh = true;
      }
      const prevP = this.persistTargets[this.persistIndex];
      this.persistIndex = 1 - this.persistIndex;
      const next = this.persistTargets[this.persistIndex];
      const pp = programs.persist;
      this.pass(next, pp);
      this.bind(0, shown.textures[0], pp.u.uGlyphs);
      this.bind(1, shown.textures[1], pp.u.uCells);
      this.bind(2, prevP.textures[0], pp.u.uPrevGlyphs);
      this.bind(3, prevP.textures[1], pp.u.uPrevCells);
      this.bind(4, this.shapesTex, pp.u.uShapes);
      // Frame-rate independent: `persistence` is what survives 1/60 s.
      const frames = (this.dt || 1 / 60) * 60;
      gl.uniform1f(pp.u.uDecay, Math.pow(Math.min(o.persistence, 0.99), frames));
      gl.uniform1f(pp.u.uFade, (1.5 / 255) * frames);
      gl.uniform1i(pp.u.uFresh, this.persistFresh ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.persistFresh = false;
      shown = next;
    } else {
      this.persistFresh = true;
    }

    this.shown = shown;

    // 4. Glow: blur the cells' light at cell resolution.
    if (glow) {
      const wp = programs.glow;
      const [ga, gb] = this.glowTargets!;
      this.pass(ga, wp);
      this.bind(0, shown.textures[0], wp.u.uSource);
      this.bind(1, this.shapesTex, wp.u.uShapes);
      gl.uniform1i(wp.u.uFromGlyphs, 1);
      gl.uniform2i(wp.u.uDirection, 1, 0);
      gl.uniform1f(wp.u.uRadius, o.glowRadius);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.pass(gb, wp);
      this.bind(0, ga.textures[0], wp.u.uSource);
      gl.uniform1i(wp.u.uFromGlyphs, 0);
      gl.uniform2i(wp.u.uDirection, 0, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      timer?.mark('glow');
    }

    // 5. Composite at full resolution.
    const cp = programs.composite;
    this.pass(null, cp);
    this.bind(0, shown.textures[0], cp.u.uGlyphs);
    this.bind(1, shown.textures[1], cp.u.uCells);
    this.bind(2, this.atlasTex, cp.u.uAtlas);
    this.bind(3, this.glowTargets![1].textures[0], cp.u.uGlowTex);
    gl.uniform2i(cp.u.uCell, atlas.cellWidth, atlas.cellHeight);
    gl.uniform2i(cp.u.uGrid, glyphs.width, glyphs.height);
    gl.uniform1i(cp.u.uAtlasColumns, atlas.columns);
    gl.uniform1i(cp.u.uYOffset, glyphs.height * atlas.cellHeight - this.canvas.height);
    gl.uniform2f(cp.u.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(cp.u.uGlow, glow ? o.glow * 2.5 : 0);
    gl.uniform1f(cp.u.uScanlines, o.scanlines);
    const crt = this.resolvedCrt();
    const calm = !this.animating;
    gl.uniform1f(cp.u.uCurvature, crt.curvature);
    gl.uniform1f(cp.u.uVignette, crt.vignette);
    gl.uniform1f(cp.u.uMask, crt.mask);
    gl.uniform1f(cp.u.uFringe, crt.fringe * this.dpr);
    gl.uniform1f(cp.u.uFlicker, calm || crt.flicker <= 0 ? 1 : 1 - crt.flicker * 0.06 * Math.random());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    timer?.mark('composite');
    timer?.endFrame();
    if (tr && this.transitionState === tr && tr.elapsed >= tr.duration) this.endTransition();
    this.dirty = false;
  }

  private bindSource(source: TexImageSource, sp: Program, aspect: number): void {
    const gl = this.gl;
    const [w, h] = sourceSize(source);
    this.bind(0, this.sourceTex, sp.u.uSource);
    const ready =
      w > 0 && h > 0 && !(source instanceof HTMLVideoElement && source.readyState < source.HAVE_CURRENT_DATA);
    if (ready && (!this.sourceUploaded || !isStatic(source))) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.sourceUploaded = true;
    }
    if (!this.sourceUploaded) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    }
    // Cover-fit the source to the grid.
    const src = w > 0 && h > 0 ? w / h : aspect;
    const scale: [number, number] = src > aspect ? [aspect / src, 1] : [1, src / aspect];
    gl.uniform2f(sp.u.uSourceScale, scale[0], scale[1]);
  }

  /** Copy both layers of a glyph grid (index + colour, background) with the mix pass. */
  private copyGrid(src: Target, dst: Target): void {
    const gl = this.gl;
    const mp = this.programs!.mix;
    gl.bindVertexArray(this.vao);
    this.pass(dst, mp);
    this.bind(0, src.textures[0], mp.u.uToGlyphs);
    this.bind(1, src.textures[1], mp.u.uToCells);
    this.bind(2, src.textures[0], mp.u.uFromGlyphs);
    this.bind(3, src.textures[1], mp.u.uFromCells);
    gl.uniform1i(mp.u.uStyle, 4);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private endTransition(): void {
    const t = this.transitionState;
    if (!t) return;
    this.transitionState = null;
    if (this.shown === t.mix) this.shown = null;
    deleteTarget(this.gl, t.from);
    deleteTarget(this.gl, t.mix);
    t.resolve();
  }

  /** The scene's own uniforms. Samplers take texture units from 2 up (0 and 1 are the source and history). */
  private applyUniforms(sp: Program): void {
    const gl = this.gl;
    let unit = 2;
    for (const [name, value] of Object.entries(this.opts.uniforms)) {
      const loc = sp.u[name];
      if (!loc) {
        // A typo, or a uniform the compiler optimized away. Say so once; never throw.
        if (!this.warnedUniforms.has(name)) {
          this.warnedUniforms.add(name);
          console.warn(`rummy: the scene has no uniform named "${name}" (or it is unused)`);
        }
        continue;
      }
      if (typeof value === 'number') gl.uniform1f(loc, value);
      else if (typeof value === 'boolean') gl.uniform1i(loc, value ? 1 : 0);
      else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value);
        else if (value.length === 3) gl.uniform3fv(loc, value);
        else if (value.length === 4) gl.uniform4fv(loc, value);
      } else {
        this.bindUniformTexture(name, value as TexImageSource, unit);
        gl.uniform1i(loc, unit++);
      }
    }
  }

  private bindUniformTexture(name: string, source: TexImageSource, unit: number): void {
    const gl = this.gl;
    let entry = this.uniformTextures.get(name);
    if (!entry) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      entry = { tex, source: null };
      this.uniformTextures.set(name, entry);
    }
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, entry.tex);
    const [w, h] = sourceSize(source);
    const ready = w > 0 && h > 0 && !(source instanceof HTMLVideoElement && source.readyState < source.HAVE_CURRENT_DATA);
    // Static images upload once; video and canvases every frame.
    if (ready && (entry.source !== source || !isStatic(source))) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      entry.source = source;
    }
  }

  // --- events --------------------------------------------------------------

  private onPointer = (e: PointerEvent): void => {
    if (!this.opts.mouse && !this.pointerEffects()) return;
    const r = this.canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = 1 - ((e.clientY - r.top) / r.height) * 2;
    if (this.opts.mouse) this.mouseTarget = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
    if (!this.pointerEffects()) return;
    const inside = Math.abs(x) <= 1 && Math.abs(y) <= 1;
    const u = (x + 1) / 2;
    const v = (y + 1) / 2;
    this.pointerUv = inside ? [u, v] : null;
    if (!inside) return;
    this.pointerAt = performance.now();
    const now = this.fxTime;
    if (e.type === 'pointerdown') this.shock = { u, v, t: now };
    // A trail point every 40 ms is enough for smooth rings.
    const last = this.trail[this.trail.length - 1];
    if (!last || now - last.t > 0.04) {
      this.trail.push({ u, v, t: now });
      if (this.trail.length > 8) this.trail.shift();
    }
    this.schedule();
  };

  /** Pointer effects in force, or null when off (option off, or reduced motion). */
  private pointerEffects(): PointerEffects | null {
    const { pointer, respectReducedMotion } = this.opts;
    if (!pointer || (respectReducedMotion && this.reducedMotion)) return null;
    return pointer === true ? pointerPreset : { ...noPointer, ...pointer };
  }

  private onMotionChange = (e: MediaQueryListEvent): void => {
    this.reducedMotion = e.matches;
    this.invalidate();
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.lost = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  private onContextRestored = (): void => {
    this.lost = false;
    this.atlas = null;
    this.programs = null;
    this.sceneTargets = this.exposureTargets = this.glowTargets = null;
    this.lumaTarget = this.glyphTarget = null;
    this.atlasTex = this.shapesTex = this.sourceTex = null;
    this.uniformTextures.clear();
    this.timer = null;
    this.init();
  };
}
