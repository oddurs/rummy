#!/usr/bin/env node
/**
 * Render the contact sheet headlessly and diff it against a baseline.
 *
 *   node scripts/shots.mjs                        render site/ into shots/current
 *   node scripts/shots.mjs --compare DIR          ...and diff against a folder of PNGs
 *   node scripts/shots.mjs --save-baseline        ...then keep it as shots/baseline
 *   node scripts/shots.mjs --twice                fail unless two renders are identical
 *   node scripts/shots.mjs --sheet                also write one montage per scene
 *
 * Other flags: --site DIR (default site), --out DIR (default shots/current),
 * --only SUBSTRING. Without --compare, shots/baseline is used when it exists.
 * Needs a built site (`pnpm build:demo`) and Chrome (CHROME_PATH to override).
 * Rendering uses SwiftShader, so output is the same on any machine with the
 * same Chrome, and runs in CI without a GPU.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, serve } from './chrome.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const site = resolve(option('site', 'site'));
const out = resolve(option('out', 'shots/current'));
const compare = option('compare', !flag('save-baseline') && existsSync('shots/baseline') ? 'shots/baseline' : undefined);
const only = option('only', '');

if (!existsSync(join(site, 'shots.html'))) {
  console.error(`No shots.html in ${site}. Run \`pnpm build:demo\` first.`);
  process.exit(2);
}

const server = await serve(site);
const chrome = await launch(`${server.origin}/shots.html?driven`);
const { evaluate } = chrome;
await chrome.waitFor('typeof window.__shots === "object"');
await evaluate('window.__shots.ready');

let failed = false;
const decode = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const dataUrl = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;

// --- render ------------------------------------------------------------------

const list = (await evaluate('window.__shots.list')).filter((n) => n.includes(only));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const t0 = Date.now();
for (const name of list) {
  try {
    const url = await evaluate(`window.__shots.render(${JSON.stringify(name)})`);
    writeFileSync(join(out, `${name}.png`), decode(url));
    if (flag('twice')) {
      const again = await evaluate(`window.__shots.render(${JSON.stringify(name)})`);
      if (again !== url) {
        console.error(`\n✗ ${name}: two renders differ (not deterministic)`);
        failed = true;
      }
    }
    process.stdout.write('.');
  } catch (err) {
    const lines = err.message.split('\n');
    console.error(`\n✗ ${name}: ${process.env.SHOTS_VERBOSE ? err.message : lines.slice(0, 12).join('\n')}`);
    failed = true;
  }
}
console.log(`\n${list.length} shots in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${out}`);

// One montage per scene, for reviewing at a glance.
if (flag('sheet')) {
  const groups = new Map();
  for (const n of list.filter((n) => existsSync(join(out, `${n}.png`)))) {
    const key = n.split('-')[0];
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  for (const [key, names] of groups) {
    const items = names.map((name) => ({ name, url: dataUrl(join(out, `${name}.png`)) }));
    writeFileSync(join(out, `sheet-${key}.png`), decode(await evaluate(`window.__shots.montage(${JSON.stringify(items)}, 4)`)));
  }
}

// --- compare -------------------------------------------------------------------

const rows = [];
if (compare && existsSync(compare)) {
  mkdirSync(join(out, 'diff'), { recursive: true });
  const baseNames = new Set(readdirSync(compare).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));
  for (const name of list) {
    if (!existsSync(join(out, `${name}.png`))) continue;
    if (!baseNames.has(name)) {
      rows.push({ name, changed: null });
      continue;
    }
    const { changed, image } = await evaluate(
      `window.__shots.diff(${JSON.stringify(dataUrl(join(compare, `${name}.png`)))}, ${JSON.stringify(dataUrl(join(out, `${name}.png`)))})`,
    );
    if (changed > 0) writeFileSync(join(out, 'diff', `${name}.png`), decode(image));
    rows.push({ name, changed });
  }
  cpSync(compare, join(out, 'base'), { recursive: true });
  rows.sort((x, y) => (y.changed ?? 2) - (x.changed ?? 2));
}

const pct = (v) => (v === null ? 'new' : `${(v * 100).toFixed(2)}%`);
const changedRows = rows.filter((r) => r.changed !== 0);
if (compare) {
  console.log(changedRows.length ? `${changedRows.length} of ${rows.length} changed against ${compare}:` : `No visual changes against ${compare}.`);
  for (const r of changedRows.slice(0, 20)) console.log(`  ${pct(r.changed).padStart(7)}  ${r.name}`);
}

writeFileSync(
  join(out, 'summary.md'),
  [
    '### rummy contact sheet',
    '',
    !compare
      ? `${list.length} shots rendered; no baseline to compare against.`
      : changedRows.length
        ? `${changedRows.length} of ${rows.length} shots changed. Download the \`shots\` artifact and open \`index.html\` for side-by-sides.`
        : `No visual changes across ${rows.length} shots.`,
    '',
    ...(changedRows.length ? ['| shot | pixels changed |', '|---|---|', ...changedRows.map((r) => `| ${r.name} | ${pct(r.changed)} |`)] : []),
    '',
  ].join('\n'),
);

// A standalone report: current, base and diff side by side.
const shown = rows.length ? rows : list.map((name) => ({ name, changed: null }));
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>rummy shots</title>
<style>body{background:#0b0b0c;color:#ccc;font:12px ui-monospace,monospace;margin:16px}
.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}
img{width:100%;border:1px solid #222}h3{font-weight:500;margin:0 0 6px}</style>
<p>${rows.length ? 'current · base · diff' : 'current'}</p>
${shown
  .map(
    (r) => `<h3>${r.name}${r.changed === null ? '' : ` — ${pct(r.changed)} changed`}</h3><div class="row"><img src="${r.name}.png" alt="">${
      rows.length && r.changed !== null ? `<img src="base/${r.name}.png" alt=""><img src="diff/${r.name}.png" alt="">` : ''
    }</div>`,
  )
  .join('\n')}`,
);

if (flag('save-baseline')) {
  rmSync('shots/baseline', { recursive: true, force: true });
  mkdirSync('shots/baseline', { recursive: true });
  for (const f of readdirSync(out).filter((f) => f.endsWith('.png') && !f.startsWith('sheet-'))) {
    cpSync(join(out, f), join('shots/baseline', f));
  }
  console.log('Saved baseline → shots/baseline');
}

if (chrome.errors.length) {
  console.error(`\nPage errors:\n${[...new Set(chrome.errors)].map((e) => `  ${e.split('\n')[0]}`).join('\n')}`);
  failed = true;
}

await chrome.close();
server.close();
process.exit(failed ? 1 : 0);
