import { defineConfig } from 'vite';

// The demo site (GitHub Pages).
export default defineConfig({
  root: 'demo',
  base: './',
  build: { outDir: '../site', emptyOutDir: true },
});
