import { buildAtlas, normalizeCharset, type Atlas, type FontSpec } from './atlas';
import {
  createProgram,
  createTarget,
  createTexture,
  deleteTarget,
  parseColor,
  type Program,
  type Target,
} from './gl';
import {
  COMPOSITE_FS,
  FULLSCREEN_VS,
  GLYPH_FS,
  SCENE_MAIN,
  SCENE_PRELUDE,
  SOURCE_SCENE,
} from './shaders';
import { ring } from './scenes';

/** GLSL defining `vec4 scene(vec2 uv)`, or any image/video/canvas to asciify. */
export type SceneInput = string | TexImageSource;

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
  /** Brightness multiplier before glyph matching. */
  gain: number;
  gamma: number;
  /** Exponent sharpening contrast inside a cell (1 = off). */
  contrast: number;
  /** Exponent sharpening contrast against neighbouring cells (1 = off). */
  directionalContrast: number;
  /** Depth-silhouette strength, 0..1. */
  edges: number;
  edgeThreshold: number;
  /** Supersampling per region: 1 (fast) or 2 (smoother). */
  quality: 1 | 2;
  /** Device pixel ratio cap. */
  maxDpr: number;
  /** 0 = uncapped. */
  maxFps: number;
  timeScale: number;
  /** Track the pointer and feed it to scenes as uMouse. */
  mouse: boolean;
  /** Shift the scene's focal point, in screen() units (y spans -1..1). */
  offset: [number, number];
  /** Darken every other device pixel row, 0..1. */
  scanlines: number;
  /** Stop rendering while the canvas is off screen. */
  pauseOffscreen: boolean;
  /** Honour prefers-reduced-motion by rendering a still frame. */
  respectReducedMotion: boolean;
}

export const charsets = {
  /** All printable ASCII: the best fit for shape matching. */
  ascii: Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join(''),
  classic: ' .:-=+*#%@',
  blocks: ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█',
  shade: ' ░▒▓█',
  lines: ' ─│┌┐└┘├┤┬┴┼╱╲╳',
  binary: ' 01',
  katakana: ' ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ012345789Z:.=*+-<>¦|',
} as const;

export const defaults: RummyOptions = {
  scene: ring,
  fontSize: 12,
  fontFamily: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontWeight: 500,
  lineHeight: 1.25,
  charset: charsets.ascii,
  mode: 'shape',
  fg: '#9dffb0',
  bg: '#050805',
  colorMix: 0,
  gain: 0.85,
  gamma: 1.15,
  contrast: 1.6,
  directionalContrast: 2.0,
  edges: 0.5,
  edgeThreshold: 0.08,
  quality: 1,
  maxDpr: 2,
  maxFps: 0,
  timeScale: 1,
  mouse: true,
  offset: [0, 0],
  scanlines: 0,
  pauseOffscreen: true,
  respectReducedMotion: true,
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

/**
 * Renders a 3D (or any) scene as ASCII into a canvas.
 *
 *   const r = new Rummy(canvas, { scene: scenes.terrain, fg: '#ffb000' });
 *   r.set({ fontSize: 16 });
 *   r.destroy();
 */
export class Rummy {
  readonly canvas: HTMLCanvasElement;
  readonly stats: RummyStats = { columns: 0, rows: 0, samples: 0, width: 0, height: 0, fps: 0 };

  private opts: RummyOptions;
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject | null = null;
  private sceneProgram: Program | null = null;
  private glyphProgram: Program | null = null;
  private compositeProgram: Program | null = null;
  private sceneTarget: Target | null = null;
  private glyphTarget: Target | null = null;
  private atlas: Atlas | null = null;
  private atlasTex: WebGLTexture | null = null;
  private shapesTex: WebGLTexture | null = null;
  private sourceTex: WebGLTexture | null = null;
  private sourceUploaded = false;

  private dpr = 1;
  private raf = 0;
  private time = 0;
  private last = -1;
  private lastDrawn = -Infinity;
  private fpsFrames = 0;
  private fpsStart = 0;
  private mouse: [number, number] = [0, 0];
  private mouseTarget: [number, number] = [0, 0];
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

    this.resizeObserver = new ResizeObserver(() => this.resize());
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
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.watchFont();
    this.schedule();
  }

  /** Current options (a copy). */
  get options(): RummyOptions {
    return { ...this.opts };
  }

  /** Update any options. Cheap for uniforms; font/charset changes rebuild the atlas. */
  set(options: Partial<RummyOptions>): void {
    const prev = this.opts;
    this.opts = { ...prev, ...options };
    const changed = (k: keyof RummyOptions) => k in options && options[k] !== prev[k];

    if (this.lost) return;
    if (changed('scene')) this.compileScene();
    if (
      changed('fontSize') ||
      changed('fontFamily') ||
      changed('fontWeight') ||
      changed('lineHeight') ||
      changed('charset') ||
      changed('maxDpr')
    ) {
      this.resize(true);
      if (changed('fontFamily') || changed('fontWeight')) this.watchFont();
    } else if (changed('quality')) {
      this.allocateTargets();
    }
    this.dirty = true;
    this.schedule();
  }

  play(): void {
    this.playing = true;
    this.schedule();
  }

  pause(): void {
    this.playing = false;
  }

  /** Render one frame now, regardless of play state. */
  render(): void {
    if (this.lost || this.destroyed || !this.atlas) return;
    this.draw();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver?.disconnect();
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    window.removeEventListener('pointermove', this.onPointer);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.release();
  }

  // --- lifecycle -----------------------------------------------------------

  private init(): void {
    const gl = this.gl;
    this.vao = gl.createVertexArray();
    this.glyphProgram = createProgram(gl, FULLSCREEN_VS, GLYPH_FS);
    this.compositeProgram = createProgram(gl, FULLSCREEN_VS, COMPOSITE_FS);
    this.compileScene();
    this.resize(true);
  }

  private release(): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    for (const p of [this.sceneProgram, this.glyphProgram, this.compositeProgram]) if (p) gl.deleteProgram(p.program);
    for (const t of [this.atlasTex, this.shapesTex, this.sourceTex]) if (t) gl.deleteTexture(t);
    deleteTarget(gl, this.sceneTarget);
    deleteTarget(gl, this.glyphTarget);
    gl.deleteVertexArray(this.vao);
    this.sceneProgram = this.glyphProgram = this.compositeProgram = null;
    this.atlasTex = this.shapesTex = this.sourceTex = null;
    this.sceneTarget = this.glyphTarget = null;
  }

  private compileScene(): void {
    const gl = this.gl;
    const { scene } = this.opts;
    const body = isSource(scene) ? SOURCE_SCENE : scene;
    const next = createProgram(gl, FULLSCREEN_VS, SCENE_PRELUDE + body + SCENE_MAIN);
    if (this.sceneProgram) gl.deleteProgram(this.sceneProgram.program);
    this.sceneProgram = next;

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
        if (faces.length && epoch === this.fontEpoch && !this.destroyed && !this.lost) this.resize(true);
      })
      .catch(() => {});
  }

  private resize(rebuildGlyphs = false): void {
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
    this.dirty = true;
    this.schedule();
  }

  private allocateTargets(): void {
    const atlas = this.atlas!;
    const columns = Math.ceil(this.canvas.width / atlas.cellWidth);
    const rows = Math.ceil(this.canvas.height / atlas.cellHeight);
    const q = this.opts.quality;
    const gl = this.gl;

    if (this.glyphTarget?.width !== columns || this.glyphTarget?.height !== rows) {
      deleteTarget(gl, this.glyphTarget);
      this.glyphTarget = createTarget(gl, columns, rows);
    }
    const sw = columns * 2 * q;
    const sh = rows * 3 * q;
    if (this.sceneTarget?.width !== sw || this.sceneTarget?.height !== sh) {
      deleteTarget(gl, this.sceneTarget);
      this.sceneTarget = createTarget(gl, sw, sh);
    }

    Object.assign(this.stats, {
      columns,
      rows,
      samples: sw * sh,
      width: this.canvas.width,
      height: this.canvas.height,
    });
    this.dirty = true;
  }

  // --- frame loop ----------------------------------------------------------

  private get animating(): boolean {
    return this.playing && !(this.opts.respectReducedMotion && this.reducedMotion);
  }

  private schedule(): void {
    if (this.raf || this.destroyed || this.lost) return;
    if (this.opts.pauseOffscreen && !this.onscreen) return;
    if (!this.animating && !this.dirty && !this.sourceIsLive()) return;
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
    if (this.animating) this.time += dt * this.opts.timeScale;

    const k = 1 - Math.exp(-dt * 5);
    this.mouse[0] += (this.mouseTarget[0] - this.mouse[0]) * k;
    this.mouse[1] += (this.mouseTarget[1] - this.mouse[1]) * k;

    const interval = this.opts.maxFps > 0 ? 1000 / this.opts.maxFps : 0;
    const due = now - this.lastDrawn >= interval - 1;
    if ((this.animating || this.dirty || this.sourceIsLive()) && due) {
      this.lastDrawn = now;
      this.draw();
      this.dirty = false;
      this.fpsFrames++;
      if (now - this.fpsStart >= 500) {
        this.stats.fps = (this.fpsFrames * 1000) / (now - this.fpsStart);
        this.fpsFrames = 0;
        this.fpsStart = now;
      }
    }
    if (!this.animating && !this.sourceIsLive()) this.last = -1;
    this.schedule();
  };

  private draw(): void {
    const gl = this.gl;
    const atlas = this.atlas!;
    const scene = this.sceneTarget!;
    const glyphs = this.glyphTarget!;
    const o = this.opts;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);

    // 1. Scene at 2x3 samples per cell.
    const sp = this.sceneProgram!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
    gl.viewport(0, 0, scene.width, scene.height);
    gl.useProgram(sp.program);
    const aspect = (glyphs.width * atlas.cellWidth) / (glyphs.height * atlas.cellHeight);
    gl.uniform1f(sp.u.uTime, this.time);
    gl.uniform2f(sp.u.uMouse, this.mouse[0], this.mouse[1]);
    gl.uniform1f(sp.u.uAspect, aspect);
    gl.uniform2f(sp.u.uResolution, scene.width, scene.height);
    gl.uniform2f(sp.u.uOffset, o.offset[0], o.offset[1]);
    if (isSource(o.scene)) this.bindSource(o.scene, sp, aspect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. One glyph per cell.
    const gp = this.glyphProgram!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, glyphs.fb);
    gl.viewport(0, 0, glyphs.width, glyphs.height);
    gl.useProgram(gp.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(gp.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shapesTex);
    gl.uniform1i(gp.u.uShapes, 1);
    gl.uniform1i(gp.u.uCount, atlas.chars.length);
    gl.uniform1i(gp.u.uQuality, o.quality);
    gl.uniform1i(gp.u.uMode, o.mode === 'density' ? 1 : 0);
    gl.uniform1f(gp.u.uGain, o.gain);
    gl.uniform1f(gp.u.uGamma, o.gamma);
    gl.uniform1f(gp.u.uContrast, o.contrast);
    gl.uniform1f(gp.u.uDirContrast, o.directionalContrast);
    gl.uniform1f(gp.u.uEdges, o.edges);
    gl.uniform1f(gp.u.uEdgeThreshold, o.edgeThreshold);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3. Composite glyphs at full resolution.
    const cp = this.compositeProgram!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(cp.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, glyphs.tex);
    gl.uniform1i(cp.u.uGlyphs, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform1i(cp.u.uAtlas, 1);
    gl.uniform2i(cp.u.uCell, atlas.cellWidth, atlas.cellHeight);
    gl.uniform1i(cp.u.uAtlasColumns, atlas.columns);
    gl.uniform1i(cp.u.uYOffset, glyphs.height * atlas.cellHeight - this.canvas.height);
    const fg = parseColor(o.fg);
    const bg = parseColor(o.bg);
    gl.uniform3f(cp.u.uFg, fg[0], fg[1], fg[2]);
    gl.uniform4f(cp.u.uBg, bg[0], bg[1], bg[2], bg[3]);
    gl.uniform1f(cp.u.uColorMix, o.colorMix);
    gl.uniform1f(cp.u.uScanlines, o.scanlines);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private bindSource(source: TexImageSource, sp: Program, aspect: number): void {
    const gl = this.gl;
    const [w, h] = sourceSize(source);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
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
    gl.uniform1i(sp.u.uSource, 0);
    gl.uniform2f(sp.u.uSourceScale, scale[0], scale[1]);
  }

  // --- events --------------------------------------------------------------

  private onPointer = (e: PointerEvent): void => {
    if (!this.opts.mouse) return;
    const r = this.canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = 1 - ((e.clientY - r.top) / r.height) * 2;
    this.mouseTarget = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
  };

  private onMotionChange = (e: MediaQueryListEvent): void => {
    this.reducedMotion = e.matches;
    this.dirty = true;
    this.schedule();
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
    this.sceneTarget = this.glyphTarget = null;
    this.atlasTex = this.shapesTex = this.sourceTex = null;
    this.init();
  };
}
