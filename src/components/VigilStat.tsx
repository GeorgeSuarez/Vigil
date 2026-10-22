import type { ReactNode } from 'react'
// Side-effect import: the wrapper owns the definition, so no host — the app, a
// test, a future Storybook — can render the element before it is registered.
import '../elements/vigil-stat'
import type { StatTone } from '../elements/vigil-stat'

export interface VigilStatProps {
  /** Short label, read before the value: "Zoom 4". */
  label: string
  /** The value: a formatted primitive, or nodes for compound counts. */
  value: ReactNode
  /** Colour family for the value. */
  tone?: StatTone
  /** Give the value full-strength weight; without it the pair reads as one unit. */
  emphasis?: boolean
}

/**
 * React wrapper for `<vigil-stat>`.
 *
 * React 19 assigns *properties* to a custom element when its instance declares
 * them, so `tone` and `emphasis` travel through the element's accessors and are
 * reflected to attributes for the `:host([...])` rules — no `ref` plumbing and
 * no attribute-only workaround.
 *
 * Content is always real light DOM: label and value are slotted, which keeps the
 * text in document order for screen readers and findable by `getByText`.
 */
export function VigilStat({ label, value, tone = 'neutral', emphasis = false }: VigilStatProps) {
  return (
    // `true`/`undefined` (not `''`) because React sets the declared boolean
    // property; the element's setter is what turns it into an attribute.
    <vigil-stat tone={tone} emphasis={emphasis ? true : undefined}>
      <span slot="label">{label}</span>
      <span slot="value">{value}</span>
    </vigil-stat>
  )
}
