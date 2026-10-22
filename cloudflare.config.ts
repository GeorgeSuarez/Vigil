import { defineConfig } from 'cf/config'

// Cloudflare Workers configuration for the static SPA. The Cloudflare Vite
// plugin turns the Vite client build into an assets-only Build Output, so no
// Worker entrypoint is needed. `notFoundHandling` gives the SPA its
// index.html fallback for client-side routes.
export default defineConfig({
  worker: {
    name: 'arcgis-vigil',
    compatibilityDate: '2026-10-21',
    observability: { enabled: true },
    workersDev: true,
    assets: {
      notFoundHandling: 'single-page-application',
    },
  },
})
