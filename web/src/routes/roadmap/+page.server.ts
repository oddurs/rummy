import { loadRoadmap } from '$lib/server/roadmap';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => {
  // Fresh enough for a roadmap; cheap enough to recompute every minute.
  setHeaders({ 'cache-control': 'public, max-age=60' });
  return loadRoadmap();
};
