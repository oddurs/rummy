import { defineConfig } from 'vite';

// The library bundle: one ES module, zero runtime dependencies.
export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'rummy.js' },
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: true,
    minify: true,
  },
});
