import { defineConfig } from 'vite';
import { glsl } from './scripts/glsl-minify.ts';

// The library bundle: one ES module, zero runtime dependencies.
export default defineConfig({
  plugins: [glsl()],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'rummy.js' },
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: true,
    minify: true,
    // Library mode keeps whitespace in ES output by default; ask for the real thing.
    rolldownOptions: { output: { minify: true } },
  },
});
