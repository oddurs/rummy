// Production server: `pnpm start` (or `node start.js`) after `pnpm build`.
//
// Wraps adapter-node's handler rather than running build/index.js, so the
// security headers reach every response, including prerendered pages and
// static assets, which never pass through hooks.server.ts.
import { createServer } from 'node:http';
import { handler } from './build/handler.js';
import { securityHeaders } from './security.js';

const port = Number(process.env.PORT ?? 4499);
const host = process.env.HOST ?? '0.0.0.0';
// Behind a platform proxy the public URL is https even though we listen on http.
const headers = securityHeaders({ https: (process.env.ORIGIN ?? '').startsWith('https:') });

const server = createServer((req, res) => {
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  handler(req, res, () => {
    res.statusCode = 404;
    res.end('Not found');
  });
});

server.listen(port, host, () => console.log(`rummy-web listening on http://${host}:${port}`));

// Let in-flight requests finish when the platform stops us.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
