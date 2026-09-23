import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { glsl } from '../scripts/glsl-minify.ts';

export default defineConfig({
  // Shaders minified in production builds, exactly as the library ships them.
  plugins: [glsl(), sveltekit()],
  build: {
    // Never inline assets as data: URIs. The CSP allows fonts and images from
    // 'self' only, and separate files cache better anyway.
    assetsInlineLimit: 0,
  },
  server: {
    port: 4499,
    strictPort: true,
    // The library and the shared looks live outside web/.
    fs: { allow: ['..'] },
  },
  preview: { port: 4499, strictPort: true },
});
