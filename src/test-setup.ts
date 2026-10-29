import '@testing-library/jest-dom/vitest'
import { afterEach, expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import { cleanup } from '@testing-library/react'

// Registers `toHaveNoViolations`, which prints each violation with its help URL
// and the failing node. `src/types/vitest-axe.d.ts` adds it to Vitest's types.
expect.extend(axeMatchers)

// vitest globals are off, so register RTL's auto-cleanup explicitly.
afterEach(() => {
  cleanup()
})

/** jsdom lacks browser APIs some libraries assume exist — install the
 * minimum viable stubs, only when the real thing is missing. */
function installPolyfills(): void {
  if (!('matchMedia' in window)) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    })
  }

  if (!('ResizeObserver' in globalThis)) {
    // Only the three lifecycle methods are ever called; nothing observes.
    const observer = () => ({ observe() {}, unobserve() {}, disconnect() {} })
    Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: observer })
  }
}

installPolyfills()
