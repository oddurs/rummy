/**
 * Charset presets. Each is a plain string, exported on its own so a bundle only
 * carries the ones it imports; `charsets` gathers them for convenience.
 */

/** All printable ASCII: the best fit for shape matching. */
export const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');

export const charsets = {
  ascii,
  classic: ' .:-=+*#%@',
  blocks: ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█',
  shade: ' ░▒▓█',
  lines: ' ─│┌┐└┘├┤┬┴┼╱╲╳',
  binary: ' 01',
  katakana: ' ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ012345789Z:.=*+-<>¦|',
} as const;
