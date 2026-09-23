/**
 * Colour palettes for quantizing cell colour. Pass one as `palette`; cells snap
 * to the nearest entry in OKLab, with an ordered dither across cells so
 * gradients stay smooth. Up to 32 colours.
 */
export const palettes = {
  ansi16: [
    '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
    '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff',
  ],
  cga: ['#000000', '#55ffff', '#ff55ff', '#ffffff'],
  ega: [
    '#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
    '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff',
  ],
  gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  c64: [
    '#000000', '#ffffff', '#68372b', '#70a4b2', '#6f3d86', '#588d43', '#352879', '#b8c76f',
    '#6f4f25', '#433900', '#9a6759', '#444444', '#6c6c6c', '#9ad284', '#6c5eb5', '#959595',
  ],
  phosphorGreen: ['#0a1f0c', '#1f5f2a', '#3fbf55', '#9dffb0'],
  phosphorAmber: ['#1f1200', '#6b3f00', '#d98a00', '#ffd27a'],
  paper: ['#efe9dc', '#b9b2a3', '#6d685e', '#1b1b18'],
} as const satisfies Record<string, readonly string[]>;

export type PaletteName = keyof typeof palettes;
