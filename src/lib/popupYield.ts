import { watch } from '@arcgis/core/core/reactiveUtils'
import type MapView from '@arcgis/core/views/MapView'

/** The floating panel `LayerPanel` renders over the map. */
const OVERLAY_SELECTOR = '.app-main .side-panel'

/**
 * Steps the side panel aside while a popup is open.
 *
 * A popup is placed beside the feature it describes, and the SDK has no notion of
 * an app-owned overlay: a feature near the right edge put the popup *underneath*
 * the panel, and on a phone the sheet covered its lower half. `view.padding`
 * moves the view's own UI but not popups — even docked popups only honour it
 * partially (measured 35px still hidden) — so the panel yields instead: it slides
 * out and goes `inert` (dropping out of the tab order and the accessibility tree)
 * until the popup closes.
 *
 * Returns a stop function that restores the panel.
 */
export function startPopupYield(view: MapView): () => void {
  const panel = document.querySelector<HTMLElement>(OVERLAY_SELECTOR)
  const shell = panel?.parentElement
  if (!panel || !shell) return () => {}

  const apply = (visible: boolean): void => {
    shell.toggleAttribute('data-popup-open', visible)
    panel.toggleAttribute('inert', visible)
  }

  // `initial: true` matters: the panel must not wait for the first change event.
  const handle = watch(() => Boolean(view.popup?.visible), apply, { initial: true })

  return () => {
    handle.remove()
    apply(false)
  }
}
