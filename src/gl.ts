export type Uniforms = Record<string, WebGLUniformLocation>;

export interface Program {
  program: WebGLProgram;
  u: Uniforms;
}

function numbered(src: string): string {
  return src
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4)} | ${line}`)
    .join('\n');
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`rummy: shader compile failed\n${log}\n${numbered(src)}`);
  }
  return shader;
}

export function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const program = gl.createProgram()!;
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  gl.linkProgram(program);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`rummy: program link failed\n${gl.getProgramInfoLog(program)}`);
  }
  const u: Uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, '');
    const loc = gl.getUniformLocation(program, info.name);
    if (loc) u[name] = loc;
  }
  return { program, u };
}

export interface TextureSpec {
  width: number;
  height: number;
  internalFormat: number;
  format: number;
  type: number;
  filter?: number;
  data?: ArrayBufferView | null;
}

export function createTexture(gl: WebGL2RenderingContext, spec: TextureSpec): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const filter = spec.filter ?? gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    spec.internalFormat,
    spec.width,
    spec.height,
    0,
    spec.format,
    spec.type,
    spec.data ?? null,
  );
  return tex;
}

export interface Target {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
  width: number;
  height: number;
}

/** An RGBA8 render target sampled with texelFetch. */
export function createTarget(gl: WebGL2RenderingContext, width: number, height: number): Target {
  const tex = createTexture(gl, {
    width,
    height,
    internalFormat: gl.RGBA8,
    format: gl.RGBA,
    type: gl.UNSIGNED_BYTE,
  });
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, width, height };
}

export function deleteTarget(gl: WebGL2RenderingContext, t: Target | null): void {
  if (!t) return;
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fb);
}

let colorCtx: CanvasRenderingContext2D | null = null;
const colorCache = new Map<string, [number, number, number, number]>();

/** Parse any CSS color into linear-ish [r, g, b, a] in 0..1 (sRGB values, as the canvas sees them). */
export function parseColor(css: string): [number, number, number, number] {
  const hit = colorCache.get(css);
  if (hit) return hit;
  if (!colorCtx) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    colorCtx = c.getContext('2d', { willReadFrequently: true })!;
  }
  colorCtx.clearRect(0, 0, 1, 1);
  colorCtx.fillStyle = '#000';
  colorCtx.fillStyle = css;
  colorCtx.fillRect(0, 0, 1, 1);
  const d = colorCtx.getImageData(0, 0, 1, 1).data;
  const a = d[3] / 255;
  // getImageData returns un-premultiplied values; guard fully transparent.
  const rgba: [number, number, number, number] = a === 0 ? [0, 0, 0, 0] : [d[0] / 255, d[1] / 255, d[2] / 255, a];
  if (colorCache.size > 64) colorCache.clear();
  colorCache.set(css, rgba);
  return rgba;
}
