import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // The Cloudflare plugin produces the Workers Build Output that `cf deploy`
  // uploads. Its Vite integration conflicts with Vitest's pipeline, so skip it
  // in test mode.
  plugins: [react(), ...(mode === 'test' ? [] : [cloudflare()])],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
}))
