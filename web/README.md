# rummy website

SvelteKit with `adapter-node`, on port **4499** in development and production.

```sh
pnpm web            # dev server with HMR on http://localhost:4499 (from the repo root)
pnpm web:check      # svelte-check; warnings fail
pnpm web:build      # production build into web/build
pnpm web:start      # production server on :4499 (PORT and HOST override)
```

| route | what | rendering |
|---|---|---|
| `/` | landing: hero, live scene tiles, how it works, cost, usage | prerendered |
| `/play` | every option live, state in the URL | prerendered shell |
| `/roadmap` | milestones and items from `cairn/items/*.md` | server, per request (60 s cache) |
| `/healthz` | `{ ok, uptime }` for deploy health checks | server, uncached |

## How it's put together

- **The library comes from source.** `@oddurs/rummy` is aliased to `../src`, so editing
  the engine hot-reloads the site. Production builds minify the GLSL with the same
  plugin the library uses.
- **`<Rummy>`** (`src/lib/Rummy.svelte`) owns an instance. It is created on mount,
  updated in place when `options` change (no new WebGL context), and destroyed on
  unmount. Without WebGL2 the canvas stays empty instead of breaking the page.
- **The roadmap is read at request time** from `CAIRN_DIR`, or the repo's own
  `cairn/items`. If neither exists (a deploy without the repo), it falls back to a
  snapshot bundled at build time. The page says which one it used.
- **Security.**
  - A strict CSP from `svelte.config.js`: `'self'` only, with nonces and hashes for
    SvelteKit's scripts.
  - Fonts are self-hosted and assets are never inlined as `data:` URIs, so nothing
    needs a CSP exception.
  - Other headers (`nosniff`, frame denial, COOP, Permissions-Policy, HSTS behind
    https) come from `security.js`. `start.js` applies them to every response,
    including prerendered pages and static files that never reach
    `hooks.server.ts`; the hook covers `vite dev`.
- **The production server** (`start.js`) wraps adapter-node's handler, serves the
  precompressed brotli/gzip assets, and drains in-flight requests on SIGTERM.

## Deploying

Any Node 20+ host: `pnpm install && pnpm web:build`, then `pnpm web:start`. Set
`ORIGIN` to the public URL (e.g. `https://rummy.example.com`) so SvelteKit's CSRF
checks and HSTS know it. Keep `cairn/items` in the deploy for a live roadmap, or set
`CAIRN_DIR`. See `.env.example`.
