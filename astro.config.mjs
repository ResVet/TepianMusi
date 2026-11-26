import { defineConfig } from 'astro/config';

// The og:image link has to be absolute. Netlify sets URL during its builds;
// elsewhere pass SITE_URL (for example https://resvet.github.io).
export default defineConfig({
  site: process.env.SITE_URL ?? process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? 'http://localhost:4321',
  // set BASE_PATH (for example /TepianMusi) when hosting under a subfolder
  base: process.env.BASE_PATH ?? '/',
  build: { inlineStylesheets: 'auto' },
  vite: {
    build: { chunkSizeWarningLimit: 1500 },
  },
});
