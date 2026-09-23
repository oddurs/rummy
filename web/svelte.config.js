import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  compilerOptions: { runes: true },
  kit: {
    // Gzip and brotli copies of static assets, served by the Node server.
    adapter: adapter({ precompress: true }),
    alias: {
      // The library straight from source: edits to src/ hot-reload the site.
      '@oddurs/rummy': '../src/index.ts',
      // Shared looks, so the site and the screenshot harness agree.
      $demo: '../demo',
    },
    // Nothing on the page comes from another origin: fonts are self-hosted and
    // the library makes no requests. SvelteKit adds nonces/hashes for its own
    // inline scripts. Styles allow 'unsafe-inline' because Svelte writes style
    // attributes; with it present, Kit leaves style-src without nonces.
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'blob:'],
        'font-src': ['self'],
        'connect-src': ['self'],
        'media-src': ['self', 'blob:'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
        'frame-ancestors': ['none'],
      },
    },
  },
};
