import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { securityHeaders } from '../security.js';

const headers = securityHeaders({ https: !dev });

/** Same headers as start.js, for `vite dev` and server-rendered responses. */
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
};
