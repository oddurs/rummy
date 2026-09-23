#!/usr/bin/env node
/**
 * Measurements behind v0.2's acceptance criteria, as regression checks:
 *
 *   silhouettes  straight outlines draw as strokes (/ \ | _ - ' .), not letters
 *   exposure     auto-exposure holds still on a steady source and settles
 *                after a cut without overshooting
 *
 *   node scripts/measure.mjs [--site site] [--json]
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, serve } from './chrome.mjs';

const args = process.argv.slice(2);
const i = args.indexOf('--site');
const site = resolve(i >= 0 ? args[i + 1] : 'site');
if (!existsSync(join(site, 'shots.html'))) {
  console.error(`No shots.html in ${site}. Run \`pnpm build:demo\` first.`);
  process.exit(2);
}

const server = await serve(site);
const chrome = await launch(`${server.origin}/shots.html?driven`);
await chrome.waitFor('typeof window.__shots === "object"');
await chrome.evaluate('window.__shots.ready');

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};

// --- silhouettes -----------------------------------------------------------------
const sil = await chrome.evaluate('window.__shots.silhouettes()');
const share = (c, k) => ((c[k] / Math.max(c.cells, 1)) * 100).toFixed(0);
const fmt = (c) =>
  `${c.cells} cells: ${share(c, 'slashes')}% / \\, ${share(c, 'strokes')}% | _ -, ${share(c, 'letters')}% letters, ${share(c, 'other')}% other  [${c.top.map(([ch, n]) => `${ch}×${n}`).join(' ')}]`;
console.log('\nsilhouettes: outline cells of flat shapes');
for (const [shape, about] of [
  ['spike', 'edges at the angle a / glyph draws'],
  ['diamond', 'edges at 45°, which a 2:1 cell draws as runs like _.-\''],
]) {
  console.log(`  ${shape} (${about})`);
  console.log(`    edges 0.6: ${fmt(sil[shape].edges)}`);
  console.log(`    edges 0:   ${fmt(sil[shape].noEdges)}`);
}
const s = sil.spike.edges;
check(s.slashes > s.letters, 'steep diagonals draw as / and \\ more often than as letters');
check(s.slashes > sil.spike.noEdges.slashes, 'directional edges draw more slashes than no edges');
const d = sil.diamond.edges;
check(d.letters < (d.slashes + d.strokes + d.other) / 2, '45° outlines are mostly strokes and punctuation, not letters');

// --- exposure --------------------------------------------------------------------
const exp = await chrome.evaluate('window.__shots.exposure()');
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => Math.sqrt(mean(a.map((v) => (v - mean(a)) ** 2)));
const steadyMean = mean(exp.steady);
const steadyVar = sd(exp.steady) / steadyMean;
const final = mean(exp.step.slice(-20));
const settle = exp.step.findIndex((v, k) => exp.step.slice(k).every((w) => Math.abs(w - final) / final < 0.05));
const overshoot = Math.max(...exp.step.map((v) => (final - v) / final));
console.log(`\nexposure (live canvas source, ${exp.msPerFrame.toFixed(1)} ms/frame)`);
console.log(`  steady dark frame: exposure ${steadyMean.toFixed(3)}, relative sd ${(steadyVar * 100).toFixed(2)}%`);
console.log(
  `  cut to bright: ${exp.step[0].toFixed(3)} → ${final.toFixed(3)}, within 5% after ${settle} frames (${((settle * exp.msPerFrame) / 1000).toFixed(2)} s), undershoot past final ${(Math.max(overshoot, 0) * 100).toFixed(1)}%`,
);
check(steadyVar < 0.01, 'no pumping on a steady source (relative sd < 1%)');
check(settle >= 0 && settle * exp.msPerFrame < 2000, 'settles within 2 s of a cut');
check(overshoot < 0.02, 'no overshoot past the settled value');

if (args.includes('--json')) console.log(JSON.stringify({ silhouettes: sil, exposure: exp }, null, 2));
if (chrome.errors.length) {
  console.error(`\nPage errors:\n${[...new Set(chrome.errors)].map((e) => `  ${e.split('\n')[0]}`).join('\n')}`);
  failures.push('page errors');
}
await chrome.close();
server.close();
process.exit(failures.length ? 1 : 0);
