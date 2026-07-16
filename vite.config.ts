import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Mermaid is intentionally an npm dependency so it is bundled into the static
// build (NFR-1 / NFR-5). Do NOT switch this to a CDN import.
//
// Two build shapes:
//   npm run build            → normal static bundle in dist/ (code-split)
//   STANDALONE=1 npm run ... → one self-contained index.html (all JS/CSS/Mermaid
//                              inlined) that runs from file:// with no install.
const standalone = process.env.STANDALONE === '1';

export default defineConfig({
  plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
  base: './',
  build: {
    target: 'es2021',
    sourcemap: !standalone,
    outDir: standalone ? 'dist-standalone' : 'dist',
    // Inline everything into index.html for the standalone build.
    ...(standalone
      ? {
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
          reportCompressedSize: false,
        }
      : {}),
  },
});
