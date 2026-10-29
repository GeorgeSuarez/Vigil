/**
 * Typing for the `toHaveNoViolations` matcher registered in `src/test-setup.ts`.
 *
 * vitest-axe's own `extend-expect` declaration augments a global `Vi` namespace
 * that Vitest 5 no longer reads, so the interface is augmented here instead.
 */
declare module 'vitest' {
  interface Assertion {
    /** Asserts an axe results object reported no violations. */
    toHaveNoViolations(): void
  }

  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void
  }
}

export {}
