#!/usr/bin/env node
/**
 * Measurements behind v0.2's acceptance criteria, as regression checks:
 *
 *   silhouettes  straight outlines draw as strokes (/ \ | _ - ' .), not letters
 *   motion       no boil (A→B→A flicker) and no lag against point sampling
 *   uniforms     custom uniforms apply live, merge, and never recompile
 *   scroll       uScroll tracks the page with one layout read per frame
 *   transitions  resolve, end on the live frame, and don't jump when interrupted
 *   governor     sheds detail under load, keeps the page responsive, recovers
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

// --- glyph boil --------------------------------------------------------------------
const churn = await chrome.evaluate('window.__shots.churn()');
console.log('\nmotion at 60 fps: default vs point sampling (antialias 0), against a refined still');
console.log('  scene     flicker (A→B→A)       error vs ideal          churn');
const pct = (v) => `${(v * 100).toFixed(2)}%`;
for (const c of churn) {
  console.log(
    `  ${c.scene.padEnd(9)} ${pct(c.flicker).padStart(6)} (points ${pct(c.flickerPoints).padEnd(6)})   ${pct(c.error).padStart(6)} (points ${pct(c.errorPoints).padEnd(6)})   ${pct(c.churn)}`,
  );
}
check(churn.every((c) => c.flicker < 0.005), 'no boil: under 0.5% of cells flicker (A→B→A) in any scene');
const worst = Math.max(...churn.map((c) => c.error - c.errorPoints));
// Varies run to run by about half a point (1.22-1.65% seen on identical code), so the bound is 2.
check(worst < 0.02, `temporal smoothing costs < 2 points of accuracy against point sampling (worst ${pct(worst)})`);

// --- custom uniforms -----------------------------------------------------------------
const u = await chrome.evaluate('window.__shots.uniformsCheck()');
console.log('\ncustom uniforms');
check(u.changed, 'uniform values reach the scene (each change alters the frame)');
check(u.compiles === 0, `set({ uniforms }) never recompiles (${u.compiles} shader compiles)`);
check(u.merged, 'set({ uniforms }) merges with the existing values');
check(u.warnings === 1, `an unknown uniform warns once and doesn't throw (${u.warnings} warning)`);

// --- scroll --------------------------------------------------------------------------
const sc = await chrome.evaluate('window.__shots.scrollCheck()');
console.log(`\nscroll: tracked ${(sc.tracked * 100).toFixed(0)}% (expect 50), pinned ${(sc.pinned * 100).toFixed(0)}% (expect 25), ${sc.readsPerFrame.toFixed(2)} rect reads/frame, ${sc.readsWhilePaused} while paused`);
check(Math.abs(sc.tracked - 0.5) < 0.06, 'uScroll follows the page (half scrolled → 0.5)');
check(Math.abs(sc.pinned - 0.25) < 0.06, 'a number pins uScroll');
check(sc.readsPerFrame <= 1.01, 'at most one layout read per frame');
check(sc.readsWhilePaused === 0, 'no layout reads while paused');

// --- transitions -----------------------------------------------------------------------
const tr = await chrome.evaluate('window.__shots.transitionCheck()');
const p100 = (v) => `${(v * 100).toFixed(0)}%`;
console.log(
  `\ntransitions: halfway ${p100(tr.halfway.from)} old / ${p100(tr.halfway.to)} new / ${p100(tr.halfway.scramble)} scramble; interrupt changes ${p100(tr.interruptJump)} of cells; paused run finished in ${tr.pausedFinishedMs.toFixed(0)} ms`,
);
check(tr.resolved, 'transition() resolves');
check(tr.endsLive, 'a finished transition shows the live frame');
check(tr.halfway.from > 0.1 && tr.halfway.to > 0.1 && tr.halfway.scramble > 0.02, 'halfway shows old, new and scrambling cells');
check(tr.interruptJump < 0.15, 'interrupting continues from what is on screen (no jump)');
check(tr.pausedFinishedMs < 1500, 'a paused renderer still runs a transition to the end');
await chrome.emulateMedia({ 'prefers-reduced-motion': 'reduce' });
const rt = await chrome.evaluate('window.__shots.reducedTransitionCheck()');
await chrome.emulateMedia({ 'prefers-reduced-motion': 'no-preference' });
check(rt.reduced && rt.scramble === 0, `under reduced motion a transition dissolves with no scramble (${(rt.scramble * 100).toFixed(1)}% scrambled cells)`);

// --- frame-time governor --------------------------------------------------------------
const gv = await chrome.evaluate('window.__shots.governorCheck()');
console.log(
  `\ngovernor (SwiftShader, terrain, load ${gv.load}): off → page ${gv.fixedFps.toFixed(0)} fps, rummy ${gv.fixedDrawn.toFixed(0)} fps; ` +
    `on → level ${gv.levelUnderLoad}, page ${gv.governedFps.toFixed(0)} fps, rummy ${gv.governedDrawn.toFixed(0)} fps; ` +
    `${gv.changesWhileSlow} level changes under load; back to level ${gv.levelAfterRecovery} when cheap`,
);
check(gv.fixedFps < 30, 'the test load is genuinely slow with the governor off (under 30 fps)');
check(gv.levelUnderLoad > 0, 'under load the governor sheds detail');
check(gv.governedFps > gv.fixedFps * 1.25, 'shedding keeps the page responsive (page frame rate up at least 25%)');
// Stepping down takes levelUnderLoad changes; a probe up that fails and steps
// back adds two. More than one failed probe in ~9 s would be flapping (the
// wait before the next probe doubles each time one fails).
check(gv.changesWhileSlow <= gv.levelUnderLoad + 2, `no flapping: at most one failed probe under load (${gv.changesWhileSlow} changes)`);
check(gv.levelAfterRecovery < gv.levelUnderLoad, 'when there is room again it climbs back up');
check(gv.levelFixed === 0, 'adaptive: false stays at full detail');

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
