import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const started = Date.now();

/** Liveness for deploy targets: cheap, uncached, no dependencies. */
export const GET: RequestHandler = () =>
  json(
    { ok: true, uptime: Math.round((Date.now() - started) / 1000) },
    { headers: { 'cache-control': 'no-store' } },
  );
