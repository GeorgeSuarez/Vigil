import Map from '@arcgis/core/Map'
import MapView from '@arcgis/core/views/MapView'
import Home from '@arcgis/core/widgets/Home'
import Legend from '@arcgis/core/widgets/Legend'
import ScaleBar from '@arcgis/core/widgets/ScaleBar'
import Search from '@arcgis/core/widgets/Search'
import { configureArcgisSdk } from './arcgis'
import { buildFeatureLayers, type FeatureLayer } from './layers'

/** Snapshot of view state surfaced in the status bar. */
export interface ViewStatus {
  zoom: number | null
  scale: number | null
  lat: number | null
  lon: number | null
}

export interface CreateCityViewOptions {
  container: HTMLDivElement
  basemap: string
  apiKey: string
  onStatusChange: (status: ViewStatus) => void
}

export interface CityView {
  view: MapView
  layers: readonly FeatureLayer[]
}

/** Contiguous US center used for the initial extent. */
const CONUS_CENTER: [number, number] = [-98.5, 39.8]

/**
 * Framework-agnostic factory that wires the map, demo layers, and widgets.
 * React owns the lifecycle in MapContainer; everything SDK-specific lives here
 * so it can be swapped or mocked without touching UI code.
 */
export function createCityView({
  container,
  basemap,
  apiKey,
  onStatusChange,
}: CreateCityViewOptions): CityView {
  configureArcgisSdk(apiKey)

  const layers = buildFeatureLayers()
  const map = new Map({ basemap, layers })
  const view = new MapView({
    container,
    map,
    center: CONUS_CENTER,
    zoom: 4,
    popupEnabled: true,
  })

  // Throttle status updates to one per animation frame.
  let frame = 0
  const notify = (): void => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      onStatusChange({
        zoom: view.zoom ?? null,
        scale: view.scale ?? null,
        lat: view.center?.latitude ?? null,
        lon: view.center?.longitude ?? null,
      })
    })
  }
  view.watch('zoom', notify)
  view.watch('scale', notify)
  view.watch('center', notify)

  view.ui.add(new Home({ view }), 'top-left')

  // The Search widget calls the ArcGIS World Geocoder, which requires an API key.
  if (apiKey) {
    view.ui.add(new Search({ view }), 'top-left')
  }

  view.ui.add(new Legend({ view }), 'bottom-left')
  view.ui.add(new ScaleBar({ view, unit: 'dual' }), 'bottom-left')

  return { view, layers }
}
