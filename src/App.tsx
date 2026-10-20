import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Header } from './components/Header'
import { BASEMAP_OPTIONS } from './lib/basemaps'
import { LayerPanel } from './components/LayerPanel'
import { MapContainer } from './components/MapContainer'
import { StatusBar, type ExtentItem } from './components/StatusBar'
import { useLayerVisibility } from './hooks/useLayerVisibility'
import { apiKey, hasApiKey } from './lib/arcgis'
import type { ExtentStats, ViewStatus } from './lib/createCityView'
import { LAYER_DESCRIPTORS } from './lib/layers'
import { parseUrlState, serializeUrlState } from './lib/urlState'

const INITIAL_STATUS: ViewStatus = {
  zoom: null,
  scale: null,
  lat: null,
  lon: null,
}

const HASH_WRITE_DELAY_MS = 300

export function App() {
  // Shared map state (basemap, extent, visible layers) is restored from the
  // URL hash once on mount; afterwards the hash mirrors live state below.
  const initial = useMemo(
    () =>
      parseUrlState(window.location.hash, {
        knownBasemaps: BASEMAP_OPTIONS.map((option) => option.value),
        knownLayerIds: LAYER_DESCRIPTORS.map((layer) => layer.id),
      }),
    [],
  )

  const [basemap, setBasemap] = useState(initial.basemap ?? 'osm')
  const [visibility, toggleVisibility] = useLayerVisibility(
    LAYER_DESCRIPTORS,
    initial.visibleLayers,
  )
  const [status, setStatus] = useState<ViewStatus>(INITIAL_STATUS)
  const [extentStats, setExtentStats] = useState<ExtentStats>({})

  // Stable identities so the view's watch callbacks never go stale.
  const handleStatusChange = useCallback((next: ViewStatus) => setStatus(next), [])
  const handleExtentStats = useCallback((next: ExtentStats) => setExtentStats(next), [])

  // Mirror map state into the URL hash. Debounced and written via
  // replaceState so panning never spams the browser history stack.
  const lastHash = useRef<string | null>(null)
  const hashTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const { zoom, lat, lon } = status
    if (zoom === null || lat === null || lon === null) return
    const hash = serializeUrlState({
      basemap,
      center: [lon, lat],
      zoom,
      // Single pass: visible layer ids in descriptor order.
      visibleLayers: LAYER_DESCRIPTORS.flatMap((layer) => (visibility[layer.id] ? [layer.id] : [])),
    })
    if (hash === lastHash.current) return
    lastHash.current = hash
    window.clearTimeout(hashTimer.current)
    hashTimer.current = window.setTimeout(() => {
      history.replaceState(null, '', `#${hash}`)
    }, HASH_WRITE_DELAY_MS)
  }, [basemap, status, visibility])

  useEffect(() => () => window.clearTimeout(hashTimer.current), [])

  const extentItems: ExtentItem[] = LAYER_DESCRIPTORS.flatMap((layer) =>
    layer.id in extentStats ? [{ label: layer.shortTitle, count: extentStats[layer.id] }] : [],
  )

  return (
    <div className="app-shell">
      <Header
        hasApiKey={hasApiKey}
        basemap={basemap}
        basemapOptions={BASEMAP_OPTIONS}
        onBasemapChange={setBasemap}
      />
      <main className="app-main">
        <MapContainer
          basemap={basemap}
          apiKey={apiKey}
          visibility={visibility}
          onStatusChange={handleStatusChange}
          onExtentStats={handleExtentStats}
          initialCenter={initial.center}
          initialZoom={initial.zoom}
        />
        <LayerPanel
          layers={LAYER_DESCRIPTORS}
          visibility={visibility}
          onToggle={toggleVisibility}
        />
      </main>
      <StatusBar status={status} extentItems={extentItems} />
    </div>
  )
}
