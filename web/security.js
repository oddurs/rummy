// Security headers for every response. Shared by the production server
// (start.js, which covers prerendered pages and static files) and
// src/hooks.server.ts (which covers `vite dev` and server-rendered pages).
// The CSP itself is in svelte.config.js, where SvelteKit can nonce its scripts.

/** @param {{ https: boolean }} opts */
export function securityHeaders({ https }) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    ...(https ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : {}),
  };
}
