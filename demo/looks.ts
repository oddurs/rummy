import { palettes, type RummyOptions } from '../src';

export interface Look {
  /** Engine options this look sets. */
  options: Partial<RummyOptions>;
  /** Page chrome colours, so the demo UI matches the canvas. */
  theme: { accent: string; text: string; dim: string; light?: boolean };
}

/** Every option a look may set, so switching looks resets what the last one changed. */
export const lookDefaults: Partial<RummyOptions> = {
  colorMix: 0,
  palette: null,
  cellBackground: 0,
  glow: 0,
  crt: false,
  scanlines: 0,
};

export const looks = {
  phosphor: {
    options: { fg: '#9dffb0', bg: '#050805', glow: 0.35 },
    theme: { accent: '#9dffb0', text: '#d7ffe0', dim: '#6f8f76' },
  },
  amber: {
    options: { fg: '#ffb000', bg: '#0b0700', glow: 0.4 },
    theme: { accent: '#ffb000', text: '#ffe7b0', dim: '#8f7a4f' },
  },
  paper: {
    options: { fg: '#1b1b18', bg: '#efe9dc' },
    theme: { accent: '#1b1b18', text: '#1b1b18', dim: '#77736a', light: true },
  },
  ice: {
    options: { fg: '#bfe6ff', bg: '#04070d', glow: 0.3 },
    theme: { accent: '#8fd3ff', text: '#e3f4ff', dim: '#5d7489' },
  },
  scene: {
    options: { fg: '#ffffff', bg: '#030304', colorMix: 1, glow: 0.3 },
    theme: { accent: '#ff5fc8', text: '#f3eefc', dim: '#7c7590' },
  },
  cga: {
    options: { fg: '#ffffff', bg: '#000000', colorMix: 1, palette: palettes.cga, cellBackground: 0.35 },
    theme: { accent: '#55ffff', text: '#ffffff', dim: '#ff55ff' },
  },
  crt: {
    options: { fg: '#ffb000', bg: '#0a0600', glow: 0.55, crt: true, scanlines: 0.3 },
    theme: { accent: '#ffb000', text: '#ffe7b0', dim: '#8f7a4f' },
  },
} satisfies Record<string, Look>;

export type LookName = keyof typeof looks;
