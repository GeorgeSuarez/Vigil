import { defineConfig, devices } from '@playwright/test'

/**
 * Browser accessibility audit.
 *
 * The unit suite cannot see the map: `MapContainer` imports Calcite CSS that
 * Vitest will not load, and jsdom has no layout, so `color-contrast` comes back
 * `incomplete` there. This project renders the real app in Chromium instead —
 * SDK overlays, Calcite shadow roots and computed colours included.
 *
 * `A11Y_BASE_URL` points the audit at an already-running instance (the deployed
 * Worker, say). Without it the run is hermetic: it builds and serves a preview
 * so CI never depends on a deploy having landed.
 */
const liveBaseUrl = process.env.A11Y_BASE_URL
const baseURL = liveBaseUrl ?? 'http://localhost:4173'

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: Boolean(process.env.CI),
  // The map streams layers and assets over the network; one retry absorbs a
  // cold CDN without hiding a real regression.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: liveBaseUrl
    ? undefined
    : {
        command: 'pnpm build && pnpm preview --port 4173 --strictPort',
        url: baseURL,
        // Never reuse a running server: an audit that silently measures an older
        // build is worse than the port error `--strictPort` raises instead.
        reuseExistingServer: false,
        timeout: 180_000,
      },
})
