/**
 * Per-pass GPU timing with EXT_disjoint_timer_query_webgl2.
 *
 * Each frame opens one query at the top of the frame and closes it after one
 * pass, rotating which pass: so every sample is "frame start → end of pass X",
 * and a pass's own cost is the difference from the pass before it. Measuring
 * cumulatively is deliberate. Some backends (ANGLE on Metal) defer submission
 * and effectively time from the start of the command buffer, which makes
 * back-to-back per-pass queries report running totals; cumulative samples are
 * correct on those backends and on ones with exact per-query timing alike.
 *
 * Queries are read back frames later and never waited on. Where the extension
 * is missing (Safari, some drivers) `supported` is false and nothing is
 * reported: a CPU guess labelled as GPU time would be worse than nothing.
 */

export type PassName = 'scene' | 'glyph' | 'glow' | 'composite';

export interface GpuTimes {
  scene: number;
  glyph: number;
  glow: number;
  composite: number;
  total: number;
}

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

interface Sample {
  pass: PassName;
  query: WebGLQuery;
}

const ORDER: PassName[] = ['scene', 'glyph', 'glow', 'composite'];
const MAX_IN_FLIGHT = 12;

export class GpuTimer {
  readonly supported: boolean;
  /** Smoothed milliseconds per pass. */
  readonly times: GpuTimes = { scene: 0, glyph: 0, glow: 0, composite: 0, total: 0 };

  private ext: TimerExt | null;
  private pool: WebGLQuery[] = [];
  private inFlight: Sample[] = [];
  private open: Sample | null = null;
  private passes: PassName[] = ORDER;
  private cycle = 0;
  /** Smoothed "frame start → end of pass" per pass. */
  private cumulative = new Map<PassName, number>();

  constructor(private gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    this.supported = this.ext !== null;
  }

  /** Start a frame that will run `passes`, in order. */
  beginFrame(passes: PassName[]): void {
    if (!this.ext) return;
    if (passes.join() !== this.passes.join()) this.cumulative.clear();
    this.passes = passes;
    const pass = passes[this.cycle++ % passes.length];
    const query = this.pool.pop() ?? this.gl.createQuery()!;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.open = { pass, query };
  }

  /** Call after each pass; closes the frame's query if this is its pass. */
  mark(pass: PassName): void {
    if (!this.ext || this.open?.pass !== pass) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.inFlight.push(this.open);
    this.open = null;
  }

  endFrame(): void {
    if (!this.ext) return;
    if (this.open) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.pool.push(this.open.query);
      this.open = null;
    }
    while (this.inFlight.length > MAX_IN_FLIGHT) this.pool.push(this.inFlight.shift()!.query);
    this.poll();
  }

  private poll(): void {
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext!.GPU_DISJOINT_EXT) as boolean;
    while (this.inFlight.length) {
      const s = this.inFlight[0];
      if (!gl.getQueryParameter(s.query, gl.QUERY_RESULT_AVAILABLE)) break;
      this.inFlight.shift();
      if (!disjoint) {
        const ms = (gl.getQueryParameter(s.query, gl.QUERY_RESULT) as number) / 1e6;
        const prev = this.cumulative.get(s.pass);
        this.cumulative.set(s.pass, prev === undefined ? ms : prev + (ms - prev) * 0.1);
      }
      this.pool.push(s.query);
    }
    this.derive();
  }

  private derive(): void {
    let before = 0;
    for (const pass of ORDER) {
      const at = this.passes.includes(pass) ? this.cumulative.get(pass) : undefined;
      if (at === undefined) {
        this.times[pass] = 0;
        continue;
      }
      this.times[pass] = Math.max(0, at - before);
      before = at;
    }
    this.times.total = before;
  }

  dispose(): void {
    if (this.open) this.pool.push(this.open.query);
    for (const s of this.inFlight) this.pool.push(s.query);
    for (const q of this.pool) this.gl.deleteQuery(q);
    this.pool = [];
    this.inFlight = [];
    this.open = null;
  }
}
