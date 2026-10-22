import { useCallback, useRef, useState } from 'react'
import { Header } from './components/Header'
import { BASEMAP_OPTIONS } from './lib/basemaps'
import { LayerPanel } from './components/LayerPanel'
import { MapAnnouncer } from './components/MapAnnouncer'
import { MapContainer } from './components/MapContainer'
import { NlqPanel } from './components/NlqPanel'
import { StatusBar, type ExtentItem } from './components/StatusBar'
import { useNlqRunner } from './hooks/useNlqRunner'
import { useSettledAnnouncement } from './hooks/useSettledAnnouncement'
import { useUrlMapState } from './hooks/useUrlMapState'
import { apiKey, hasApiKey } from './lib/arcgis'
import type { ExtentStats, MapController, ViewStatus } from './lib/createMapController'
import { LAYER_DESCRIPTORS } from './lib/layers'
import { hasLlmConfig } from './lib/nlq/llmConfig'

const INITIAL_STATUS: ViewStatus = {
  zoom: null,
  scale: null,
  lat: null,
  lon: null,
}

export function App() {
  const [status, setStatus] = useState<ViewStatus>(INITIAL_STATUS)
  const [extentStats, setExtentStats] = useState<ExtentStats>({})

  // Stable identities so the view's watch callbacks never go stale.
  const handleStatusChange = useCallback((next: ViewStatus) => setStatus(next), [])
  const handleExtentStats = useCallback((next: ExtentStats) => setExtentStats(next), [])

  // Map state with URL-hash persistence (restored on mount, mirrored back).
  const { basemap, setBasemap, visibility, toggleVisibility, initialCenter, initialZoom } =
    useUrlMapState(status)

  // The map container hands up the live MapController; the NLQ runner resolves
  // it fresh at call time (StrictMode recreates the container), keeping its
  // session filter state across commands.
  const controllerRef = useRef<MapController | null>(null)
  const handleMapReady = useCallback((controller: MapController) => {
    controllerRef.current = controller
  }, [])
  const runNlQuery = useNlqRunner(() => controllerRef.current)

  // The ISS marker only exists after the first successful poll, so the locate
  // action stays disabled until then.
  const [issLocatable, setIssLocatable] = useState(false)
  const handleIssFix = useCallback(() => setIssLocatable(true), [])

  const handleLocateIss = useCallback(() => {
    // Locating a hidden layer would fly to empty map, so reveal it first.
    if (!visibility.iss) toggleVisibility('iss', true)
    controllerRef.current?.locateIss()
  }, [visibility, toggleVisibility])

  const [timeStripOpen, setTimeStripOpen] = useState(
    // Collapsed by default at every width: the band is 180px of vertical space
    // that the map uses better, and the status-bar clock reveals it on demand.
    () => false,
  )

  const handleToggleTimeStrip = useCallback(() => {
    setTimeStripOpen((open) => {
      // Collapsing the strip removes the only visible time control, so
      // release the temporal filter rather than leave the map silently
      // filtered with no visible way to change it.
      if (open) controllerRef.current?.resetTimeWindow()
      return !open
    })
  }, [])

  const announcement = useSettledAnnouncement(status, extentStats)

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
          onReady={handleMapReady}
          onIssFix={handleIssFix}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          timeStripOpen={timeStripOpen}
        />
        <NlqPanel onRun={runNlQuery} llmActive={hasLlmConfig} hasApiKey={hasApiKey} />
        <LayerPanel
          layers={LAYER_DESCRIPTORS}
          visibility={visibility}
          onToggle={toggleVisibility}
          onLocateIss={handleLocateIss}
          issLocatable={issLocatable}
        />
      </main>
      <StatusBar
        status={status}
        extentItems={extentItems}
        timeStripOpen={timeStripOpen}
        onToggleTimeStrip={handleToggleTimeStrip}
      />
      <MapAnnouncer message={announcement} />
    </div>
  )
}
