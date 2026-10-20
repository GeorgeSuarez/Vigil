import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Header } from './components/Header'
import { BASEMAP_OPTIONS } from './lib/basemaps'
import { LayerPanel } from './components/LayerPanel'
import { MapAnnouncer } from './components/MapAnnouncer'
import { MapContainer } from './components/MapContainer'
import { NlqPanel } from './components/NlqPanel'
import { StatusBar, type ExtentItem } from './components/StatusBar'
import { useLayerVisibility } from './hooks/useLayerVisibility'
import { anthropicApiKey, anthropicModel, apiKey, hasAnthropicKey, hasApiKey } from './lib/arcgis'
import type { CityView, ExtentStats, ViewStatus } from './lib/createCityView'
import { formatDegrees } from './lib/format'
import { LAYER_DESCRIPTORS } from './lib/layers'
import { createNlqExecutor } from './lib/nlq/execute'
import { intentFromLlm } from './lib/nlq/llm'
import { parseNlQuery, type NlqIntent } from './lib/nlq/parser'
import { parseUrlState, serializeUrlState } from './lib/urlState'

const INITIAL_STATUS: ViewStatus = {
  zoom: null,
  scale: null,
  lat: null,
  lon: null,
}

const HASH_WRITE_DELAY_MS = 300
const ANNOUNCE_DELAY_MS = 600

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
  const [announcement, setAnnouncement] = useState<string | null>(null)

  // Stable identities so the view's watch callbacks never go stale.
  const handleStatusChange = useCallback((next: ViewStatus) => setStatus(next), [])
  const handleExtentStats = useCallback((next: ExtentStats) => setExtentStats(next), [])

  // The map container hands up the live CityView; the NLQ executor resolves it
  // fresh at call time (StrictMode recreates the container), keeping its
  // session filter state across commands.
  const cityRef = useRef<CityView | null>(null)
  const executorRef = useRef<((intents: readonly NlqIntent[]) => Promise<string>) | null>(null)
  const handleCityReady = useCallback((city: CityView) => {
    cityRef.current = city
  }, [])

  const runNlQuery = useCallback(async (text: string): Promise<string> => {
    executorRef.current ??= createNlqExecutor(() => cityRef.current)
    const executor = executorRef.current
    let intents: NlqIntent[] | null = null
    if (hasAnthropicKey) {
      try {
        intents = await intentFromLlm(text, anthropicApiKey, anthropicModel)
      } catch {
        intents = null // fall back to the offline rule-based parser
      }
    }
    return executor(intents ?? parseNlQuery(text))
  }, [])

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

  // Narrate settled map state for screen readers: announce 600ms after the
  // last change (extent stats only update on stationary/toggle/time changes,
  // which doubles as the "map stopped moving" signal).
  const announceTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const { zoom, lat, lon } = status
    if (zoom === null || lat === null || lon === null) return
    window.clearTimeout(announceTimer.current)
    announceTimer.current = window.setTimeout(() => {
      const items = LAYER_DESCRIPTORS.flatMap((layer) =>
        layer.id in extentStats ? [`${extentStats[layer.id]} ${layer.shortTitle}`] : [],
      )
      const counts = items.length > 0 ? ` ${items.join(', ')} in view.` : ''
      setAnnouncement(
        `Map centered ${formatDegrees(lat, 'lat')}, ${formatDegrees(lon, 'lon')}, zoom ${Math.round(zoom)}.${counts}`,
      )
    }, ANNOUNCE_DELAY_MS)
  }, [status, extentStats])

  useEffect(() => () => window.clearTimeout(announceTimer.current), [])

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
          onReady={handleCityReady}
          initialCenter={initial.center}
          initialZoom={initial.zoom}
        />
        <NlqPanel onRun={runNlQuery} llmActive={hasAnthropicKey} />
        <LayerPanel
          layers={LAYER_DESCRIPTORS}
          visibility={visibility}
          onToggle={toggleVisibility}
        />
      </main>
      <StatusBar status={status} extentItems={extentItems} />
      <MapAnnouncer message={announcement} />
    </div>
  )
}
