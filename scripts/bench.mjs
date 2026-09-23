#!/usr/bin/env node
/**
 * Run the bench page in headless Chrome on the real GPU and print the table.
 *
 *   node scripts/bench.mjs [--seconds 3] [--site site]
 *
 * Numbers from a headless run are indicative; for publishable numbers open
 * /bench.html in a normal browser window on the device itself.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, serve } from './chrome.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const site = resolve(option('site', 'site'));
const seconds = Number(option('seconds', 3));
if (!existsSync(join(site, 'bench.html'))) {
  console.error(`No bench.html in ${site}. Run \`pnpm build:demo\` first.`);
  process.exit(2);
}

const server = await serve(site);
const chrome = await launch(`${server.origin}/bench.html?seconds=${seconds}`, { gpu: true, width: 1920, height: 1080 });
await chrome.waitFor('typeof window.__bench === "object"');
const result = await chrome.evaluate('window.__bench.run()');
console.log(result.markdown);
await chrome.close();
server.close();
