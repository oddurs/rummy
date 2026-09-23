#!/usr/bin/env node
/**
 * Bundle-size gate. Measures the gzipped library, then bundles an app that
 * imports only `Rummy` and checks that tree-shaking leaves the other built-in
 * scenes out.
 *
 *   node scripts/size.mjs     (after `pnpm build`)
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

// Raised deliberately, never silently. History in cairn item 0009:
// 0.2 set 15 / 12.5 KB; 0.3 raised to 15.5 / 13 KB for custom uniforms, then
// 16.5 / 14 KB for transitions after identifier mangling measured only 0.17 KB.
const BUDGET = { library: 16.5 * 1024, core: 14 * 1024 };

const gz = (s) => gzipSync(s, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(2)} KB`;

const lib = readFileSync('dist/rummy.js', 'utf8');
const library = gz(lib);

const dir = mkdtempSync(join(tmpdir(), 'rummy-size-'));
writeFileSync(join(dir, 'entry.js'), `import { Rummy } from ${JSON.stringify(resolve('dist/rummy.js'))};\nexport default Rummy;\n`);
const result = await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    lib: { entry: join(dir, 'entry.js'), formats: ['es'], fileName: () => 'core.js' },
    outDir: join(dir, 'out'),
    write: false,
    minify: true,
    rolldownOptions: { output: { minify: true } },
  },
});
const code = [result].flat()[0].output[0].code;
rmSync(dir, { recursive: true, force: true });
const core = gz(code);

// Markers from scenes other than the default (ring) and from the palettes.
const leaked = [
  ['terrain', 'float height(vec2 p)'],
  ['blobs', 'float smin('],
  ['globe', 'halo'],
  ['palettes', '#0f380f'],
  ['charset presets', 'ｦｱｳ'],
].filter(([, marker]) => code.includes(marker));

console.log(`library (all scenes, palettes): ${kb(library)} gz  (budget ${kb(BUDGET.library)})`);
console.log(`core (import { Rummy } only):   ${kb(core)} gz  (budget ${kb(BUDGET.core)})`);

let failed = false;
if (library > BUDGET.library) {
  console.error(`✗ library over budget by ${kb(library - BUDGET.library)}`);
  failed = true;
}
if (core > BUDGET.core) {
  console.error(`✗ core over budget by ${kb(core - BUDGET.core)}`);
  failed = true;
}
if (leaked.length) {
  console.error(`✗ not tree-shaken out of the core: ${leaked.map(([n]) => n).join(', ')}`);
  failed = true;
}
process.exit(failed ? 1 : 0);
