import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Vitest sets this; a `vite build --mode test` does not.
const isVitest = Boolean(process.env.VITEST)

// https://vite.dev/config/
export default defineConfig({
  // The Cloudflare plugin produces the Workers Build Output that `cf deploy`
  // uploads. Its Vite integration conflicts with Vitest's pipeline, so skip it
  // while testing. This is a static SPA, so Worker type generation is unused.
  plugins: [react(), ...(isVitest ? [] : [cloudflare({ types: { generate: false } })])],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    // `e2e/` holds Playwright specs, which run under their own runner and would
    // fail here (no `page` fixture). Restricting the glob is safer than
    // overriding `exclude`, which would drop Vitest's defaults with it.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
