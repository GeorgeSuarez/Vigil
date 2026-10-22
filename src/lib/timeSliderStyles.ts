import internals from '../elements/time-slider-internals.css?inline'

/**
 * Adopts the app's TimeSlider overrides into `<arcgis-time-slider>`'s shadow
 * root.
 *
 * The component renders the SDK's TimeSlider inside a shadow root and exposes no
 * `part`s, so a global rule cannot reach the tick labels, ticks, track or
 * handles. Adopting a constructed stylesheet is the narrow way in: one sheet,
 * applied to that root only, with the same selectors index.css used before the
 * migration.
 *
 * The shadow root exists as soon as the component is upgraded, but Lumina only
 * finishes wiring its own sheets once the element is connected — so the sheet is
 * applied on connect and again on `arcgisReady`, and the pair is idempotent.
 */
export function adoptTimeSliderStyles(element: HTMLElement): void {
  if (!internals) return

  const sheet = new CSSStyleSheet()
  sheet.replaceSync(internals)

  const apply = (): void => {
    const root = element.shadowRoot
    if (!root || root.adoptedStyleSheets.includes(sheet)) return
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
  }

  apply()
  element.addEventListener('arcgisReady', apply, { once: true })
}
