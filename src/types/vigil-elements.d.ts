// Registers `<vigil-stat>` in React 19's JSX type space, the same way
// `calcite.d.ts` does for the Calcite elements. Attributes the element declares
// as properties (`tone`, `emphasis`) are typed here so React assigns them
// through the element's accessors, which then reflect to attributes for CSS.
import type { HTMLAttributes } from 'react'
import type { StatTone, VigilStatElement } from '../elements/vigil-stat'

/** Attribute surface of `<vigil-stat>`; everything else is a slot or a part. */
export interface VigilStatAttributes {
  /** Shorthand label; the `label` slot wins when both are present. */
  label?: string
  tone?: StatTone
  emphasis?: boolean
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'vigil-stat': HTMLAttributes<VigilStatElement> & VigilStatAttributes
    }
  }
}
