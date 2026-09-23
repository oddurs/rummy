import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from '$env/dynamic/private';
import { category } from '$lib/roadmap';

/**
 * The roadmap, read from cairn's item files.
 *
 * At request time the server reads `cairn/items` from disk (CAIRN_DIR, else the
 * repo's own), so a deploy that ships the repo shows the live roadmap. If the
 * files aren't there, it falls back to the snapshot bundled at build time.
 */

export interface Item {
  id: number;
  title: string;
  type: string;
  status: string;
  milestone?: string;
  key?: string;
  due?: string;
  priority?: string;
  pillar?: string;
  file: string;
}

export interface Milestone {
  key: string;
  title: string;
  status: string;
  due?: string;
  summary: string;
  items: Item[];
  done: number;
  total: number;
}

const snapshot = import.meta.glob('../../../../cairn/items/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function liveFiles(): Record<string, string> | null {
  const candidates = [env.CAIRN_DIR, 'cairn/items', '../cairn/items'].filter(Boolean) as string[];
  const dir = candidates.map((d) => resolve(d)).find((d) => existsSync(d));
  if (!dir) return null;
  const files: Record<string, string> = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.md')) files[f] = readFileSync(join(dir, f), 'utf8');
  return files;
}

/** Enough YAML for cairn frontmatter: scalars and `- ` lists. */
function parse(text: string): { meta: Record<string, string | string[]>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  const meta: Record<string, string | string[]> = {};
  if (!m) return { meta, body: text };
  let listKey: string | null = null;
  for (const line of m[1].split('\n')) {
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) {
      (meta[listKey] as string[]).push(item[1].trim());
      continue;
    }
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === '') {
      meta[k] = [];
      listKey = k;
    } else {
      meta[k] = v.replace(/^(['"])(.*)\1$/, '$2');
      listKey = null;
    }
  }
  return { meta, body: m[2] };
}

function firstParagraph(body: string): string {
  return body.trim().split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ') ?? '';
}

export interface Roadmap {
  milestones: Milestone[];
  source: 'live' | 'snapshot';
  count: number;
}

export function loadRoadmap(): Roadmap {
  const live = liveFiles();
  const files = live ?? Object.fromEntries(Object.entries(snapshot).map(([p, t]) => [p.split('/').pop()!, t]));

  const items: Item[] = [];
  const bodies = new Map<number, string>();
  for (const [file, text] of Object.entries(files)) {
    const { meta, body } = parse(text);
    const s = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : undefined);
    const id = Number(s('id'));
    if (!Number.isFinite(id)) continue;
    items.push({
      id,
      title: s('title') ?? file,
      type: s('type') ?? 'feature',
      status: s('status') ?? 'idea',
      milestone: s('milestone'),
      key: s('key'),
      due: s('due'),
      priority: s('priority'),
      pillar: s('pillar'),
      file,
    });
    bodies.set(id, body);
  }

  const order = ['p0', 'p1', 'p2', 'p3'];
  const rank = (i: Item) => (category(i.status) === 'done' ? 0 : category(i.status) === 'active' ? 1 : 2);
  const milestones = items
    .filter((i) => i.type === 'milestone' && i.key)
    .map((ms): Milestone => {
      const within = items
        .filter((i) => i.type !== 'milestone' && i.milestone === ms.key && category(i.status) !== 'dropped')
        .sort((a, b) => rank(a) - rank(b) || order.indexOf(a.priority ?? 'p2') - order.indexOf(b.priority ?? 'p2') || a.id - b.id);
      return {
        key: ms.key!,
        title: ms.title,
        status: ms.status,
        due: ms.due,
        summary: firstParagraph(bodies.get(ms.id) ?? ''),
        items: within,
        done: within.filter((i) => category(i.status) === 'done').length,
        total: within.length,
      };
    })
    // Dated milestones in date order, undated ones ("later") last.
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));

  return { milestones, source: live ? 'live' : 'snapshot', count: items.length };
}
