/**
 * Glyph atlas + shape vectors.
 *
 * Every glyph is rasterized once into a grid canvas at exact device-pixel cell
 * size. The same pixels are then measured: each cell is split into a 2x3 grid of
 * regions and the ink coverage of every region becomes that glyph's 6D "shape
 * vector". At runtime the scene is sampled at the same 2x3 regions per cell and
 * the nearest glyph wins, so `/` lands on diagonals and `_` on bottom edges
 * instead of every cell collapsing to one brightness ramp.
 */

export interface Atlas {
  canvas: HTMLCanvasElement;
  chars: string[];
  /** Glyphs per atlas row. */
  columns: number;
  /** Cell size in device pixels. */
  cellWidth: number;
  cellHeight: number;
  /** n x 2 RGBA texels: [s0 s1 s2 s3] [s4 s5 mean 0], regions ordered row-major from top-left. */
  shapes: Float32Array;
  /**
   * How much ink a line-drawing glyph (/ \ |) puts in the regions it crosses,
   * on the same normalized scale. Silhouette strokes are drawn at this level so
   * they match line glyphs rather than heavier letters.
   */
  strokeInk: number;
}

export interface FontSpec {
  family: string;
  weight: string | number;
  /** Font size in device pixels. */
  size: number;
  lineHeight: number;
}

export function fontString(f: FontSpec): string {
  return `${f.weight} ${f.size}px ${f.family}`;
}

/** Split a charset into unique code points, guaranteeing a leading space (index 0 = empty). */
export function normalizeCharset(charset: string): string[] {
  const out = [' '];
  for (const ch of charset) if (!out.includes(ch)) out.push(ch);
  if (out.length > 255) throw new Error('rummy: charset is limited to 255 glyphs');
  return out;
}

export function measureCell(font: FontSpec): { width: number; height: number } {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = fontString(font);
  return {
    width: Math.max(2, Math.round(ctx.measureText('M').width)),
    height: Math.max(3, Math.round(font.size * font.lineHeight)),
  };
}

export function buildAtlas(chars: string[], font: FontSpec): Atlas {
  const { width: cw, height: ch } = measureCell(font);
  const columns = 16;
  const rows = Math.ceil(chars.length / columns);

  const canvas = document.createElement('canvas');
  canvas.width = columns * cw;
  canvas.height = rows * ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = fontString(font);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Vertically center the font's box (not the glyph ink) so baselines line up.
  const m = ctx.measureText('Mg');
  const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
  const baseline = Math.round((ch - (ascent + descent)) / 2 + ascent);

  chars.forEach((c, i) => {
    const x = (i % columns) * cw;
    const y = Math.floor(i / columns) * ch;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cw, ch);
    ctx.clip();
    ctx.fillText(c, x + cw / 2, y + baseline);
    ctx.restore();
  });

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const raw = new Float32Array(chars.length * 6);
  const xs = [0, Math.round(cw / 2), cw];
  const ys = [0, Math.round(ch / 3), Math.round((2 * ch) / 3), ch];
  let max = 0;

  for (let i = 0; i < chars.length; i++) {
    const ox = (i % columns) * cw;
    const oy = Math.floor(i / columns) * ch;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        let sum = 0;
        for (let y = ys[r]; y < ys[r + 1]; y++) {
          const row = (oy + y) * canvas.width;
          for (let x = xs[c]; x < xs[c + 1]; x++) sum += pixels[(row + ox + x) * 4];
        }
        const area = (xs[c + 1] - xs[c]) * (ys[r + 1] - ys[r]);
        const v = sum / (255 * Math.max(1, area));
        raw[i * 6 + r * 2 + c] = v;
        if (v > max) max = v;
      }
    }
  }

  // Normalize so the inkiest region of the whole charset reads as full brightness.
  const n = chars.length;
  const shapes = new Float32Array(n * 2 * 4);
  const scale = max > 0 ? 1 / max : 0;
  for (let i = 0; i < n; i++) {
    const s = raw.subarray(i * 6, i * 6 + 6).map((v) => v * scale);
    const mean = (s[0] + s[1] + s[2] + s[3] + s[4] + s[5]) / 6;
    shapes.set([s[0], s[1], s[2], s[3]], i * 4);
    shapes.set([s[4], s[5], mean, 0], (n + i) * 4);
  }

  // Calibrate strokes from the line glyphs this charset actually has: the mean
  // of each one's inked regions (those above half its peak).
  const lines = ['/', '\\', '|'].map((c) => chars.indexOf(c)).filter((i) => i >= 0);
  let strokeInk = 0.35;
  if (lines.length) {
    const levels = lines.map((i) => {
      const v = Array.from(raw.subarray(i * 6, i * 6 + 6), (x) => x * scale);
      const peak = Math.max(...v);
      const inked = v.filter((x) => x > peak / 2);
      return inked.reduce((a, b) => a + b, 0) / inked.length;
    });
    strokeInk = levels.reduce((a, b) => a + b, 0) / levels.length;
  }

  return { canvas, chars, columns, cellWidth: cw, cellHeight: ch, shapes, strokeInk };
}
