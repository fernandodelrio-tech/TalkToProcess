import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Mermaid is intentionally an npm dependency so it is bundled into the static
// build (NFR-1 / NFR-5). Do NOT switch this to a CDN import.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2021',
    sourcemap: true,
  },
});
