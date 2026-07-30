import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The CSP in index.html allows inline scripts because the dev server injects
 * its HMR preamble inline. A production build has no inline scripts at all, so
 * the allowance is dropped there — it is the one directive that would otherwise
 * let injected markup execute.
 */
function tightenProductionCsp() {
  return {
    name: 'chirodx-tighten-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        /script-src 'self' 'unsafe-inline';/,
        "script-src 'self';"
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tightenProductionCsp()],
  // Use relative paths so the built index.html works when loaded via file://
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Electron 43 ships Chromium 140; there is no need to down-level.
    target: 'chrome140',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
