import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Register only the Calcite components this app renders. Each module defines
// its element as a side effect (customElement('calcite-switch', …)) at import
// time. The bundled `defineCustomElements()` loader instead pulls in ~100
// component chunks through a single promise, so one slow or failed chunk leaves
// EVERY component unregistered — the layer switches and the basemap select then
// render as nothing at all, which is exactly what a missing-toggle report looks
// like. Static imports have no such failure mode.
import '@esri/calcite-components/components/calcite-button'
import '@esri/calcite-components/components/calcite-chip'
import '@esri/calcite-components/components/calcite-option'
import '@esri/calcite-components/components/calcite-select'
import '@esri/calcite-components/components/calcite-switch'

import '@esri/calcite-components/main.css'
import '@arcgis/core/assets/esri/themes/dark/main.css'
import './index.css'

import { App } from './App'

// React StrictMode mounts the map twice in development: the first MapView is
// destroyed while its basemap request is still in flight, so the SDK rejects
// with AbortError and the console fills with "Uncaught (in promise)". The
// second mount loads normally and the app is unaffected — and StrictMode's
// double-invoke does not happen in production. Filter only that abort, so real
// rejections still surface.
window.addEventListener('unhandledrejection', (event) => {
  const reason: unknown = event.reason
  if (typeof reason !== 'object' || reason === null) return
  const { name, message } = reason as { name?: unknown; message?: unknown }
  if (name === 'AbortError' || message === 'Aborted') event.preventDefault()
})

const rootElement = document.querySelector<HTMLElement>('#root')
if (!rootElement) throw new Error('#root element is missing from index.html')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
