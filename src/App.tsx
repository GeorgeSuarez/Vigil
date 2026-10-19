import { useCallback, useState } from 'react'
import { Header } from './components/Header'
import { BASEMAP_OPTIONS } from './lib/basemaps'
import { LayerPanel } from './components/LayerPanel'
import { MapContainer } from './components/MapContainer'
import { StatusBar } from './components/StatusBar'
import { useLayerVisibility } from './hooks/useLayerVisibility'
import { apiKey, hasApiKey } from './lib/arcgis'
import type { ViewStatus } from './lib/createCityView'
import { LAYER_DESCRIPTORS } from './lib/layers'

const INITIAL_STATUS: ViewStatus = {
  zoom: null,
  scale: null,
  lat: null,
  lon: null,
}

export function App() {
  const [basemap, setBasemap] = useState('osm')
  const [visibility, toggleVisibility] = useLayerVisibility(LAYER_DESCRIPTORS)
  const [status, setStatus] = useState<ViewStatus>(INITIAL_STATUS)

  // Stable identity so the view's watch callbacks never go stale.
  const handleStatusChange = useCallback((next: ViewStatus) => setStatus(next), [])

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
        />
        <LayerPanel
          layers={LAYER_DESCRIPTORS}
          visibility={visibility}
          onToggle={toggleVisibility}
        />
      </main>
      <StatusBar status={status} />
    </div>
  )
}
