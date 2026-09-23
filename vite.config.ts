import { defineConfig } from 'vite';
import { glsl } from './scripts/glsl-minify.ts';

// The demo site (GitHub Pages): the hero, the contact sheet and the bench.
export default defineConfig({
  root: 'demo',
  base: './',
  // Minify shaders in the demo too, so the screenshot harness tests what ships.
  plugins: [glsl()],
  build: {
    outDir: '../site',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: new URL('demo/index.html', import.meta.url).pathname,
        shots: new URL('demo/shots.html', import.meta.url).pathname,
        bench: new URL('demo/bench.html', import.meta.url).pathname,
      },
    },
  },
});
