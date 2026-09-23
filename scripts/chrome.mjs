/**
 * Just enough headless Chrome for the scripts: a static server for the built
 * site and a DevTools-protocol page to evaluate expressions in. No
 * dependencies; Node's built-in WebSocket speaks CDP.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Serve a directory on a random local port. */
export async function serve(root) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates =
    {
      darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
      linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
      win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe'],
    }[process.platform] ?? [];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Chrome not found; set CHROME_PATH');
  return found;
}

/**
 * Launch headless Chrome and open `url`.
 * `gpu: false` (default) renders with SwiftShader, which is deterministic and
 * runs anywhere; `gpu: true` asks for the real GPU, for benchmarks.
 */
export async function launch(url, { gpu = false, width = 1200, height = 900 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'rummy-chrome-'));
  const graphics = gpu
    ? ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])]
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const chrome = spawn(
    chromePath(),
    [
      '--headless=new',
      ...graphics,
      // Ubuntu 24.04 runners block the unprivileged user namespaces Chrome's sandbox needs.
      ...(process.env.CI ? ['--no-sandbox'] : []),
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disk-cache-size=1',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  const wsUrl = await new Promise((resolveUrl, reject) => {
    let buf = '';
    chrome.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolveUrl(m[1]);
    });
    chrome.on('exit', (code) => reject(new Error(`Chrome exited (${code}) before DevTools came up`)));
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  let sessionId;
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : ok(msg.result);
      return;
    }
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception?.description ?? d.text);
    }
    // Browser-level errors (CSP violations, failed loads) arrive as log entries.
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push(msg.params.entry.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  const send = (method, params = {}, session) =>
    new Promise((ok, reject) => {
      const id = ++nextId;
      pending.set(id, { ok, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId: session }));
    });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
  const page = (method, params) => send(method, params, sessionId);
  await page('Runtime.enable');
  await page('Page.enable');
  await page('Log.enable');
  await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await page('Page.navigate', { url });

  async function evaluate(expression) {
    const r = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }

  /** Poll until `expression` is truthy. */
  async function waitFor(expression, timeout = 10000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await evaluate(expression).catch(() => false)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timed out waiting for ${expression}`);
  }

  async function close() {
    ws.close();
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill();
    await exited;
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  /** PNG of the viewport (or the whole page), as a Buffer. */
  async function screenshot({ fullPage = false } = {}) {
    const params = { format: 'png' };
    if (fullPage) {
      const { cssContentSize: size } = await page('Page.getLayoutMetrics');
      Object.assign(params, {
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 },
      });
    }
    const { data } = await page('Page.captureScreenshot', params);
    return Buffer.from(data, 'base64');
  }

  return { evaluate, waitFor, screenshot, close, errors };
}
