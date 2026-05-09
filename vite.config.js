import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tiny plugin: emit /version.json at build time with the commit SHA and
// build timestamp. The running app polls this to detect new deploys
// while a tab is open. Vercel cache headers already make /index.html
// no-cache; version.json piggybacks on that root scope.
function versionJsonPlugin() {
  return {
    name: 'fire-fc-version-json',
    apply: 'build',
    generateBundle() {
      const commit =
        process.env.VITE_VERCEL_GIT_COMMIT_SHA ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        'local-dev';
      const builtAt = new Date().toISOString();
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ commit, builtAt }, null, 2) + '\n',
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    versionJsonPlugin(),
  ],
  server: {
    port: 3000,
  },
})
