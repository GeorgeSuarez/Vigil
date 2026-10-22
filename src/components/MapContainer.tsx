import { useCallback, useEffect, useRef, useState } from 'react'
// The components are registered by importing them (the same per-component
// approach used for Calcite in main.tsx): no loader, no all-or-nothing module.
import '@arcgis/map-components/components/arcgis-map'
import '@arcgis/map-components/components/arcgis-home'
import '@arcgis/map-components/components/arcgis-legend'
import '@arcgis/map-components/components/arcgis-scale-bar'
import '@arcgis/map-components/components/arcgis-search'
import '@arcgis/map-components/components/arcgis-zoom'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import {
  CONUS_CENTER,
  DEFAULT_ZOOM,
  createMapController,
  type ExtentStats,
  type MapController,
  type ViewStatus,
} from '../lib/createMapController'
import type { AppLayer, LayerId } from '../lib/layers'

export interface MapContainerProps {
  basemap: string
  hasApiKey: boolean
  visibility: Record<LayerId, boolean>
  onStatusChange: (status: ViewStatus) => void
  onExtentStats: (stats: ExtentStats) => void
  /** Hands the live MapController (view/layers/slider) up to App once created. */
  onReady?: (controller: MapController) => void
  /** Whether the time slider strip is shown; the strip div itself stays mounted. */
  timeStripOpen: boolean
  /** Fires once the first ISS position has landed. */
  onIssFix?: () => void
  initialCenter?: [number, number]
  initialZoom?: number
}

/**
 * Hosts `<arcgis-map>`, which owns the MapView.
 *
 * The component creates and destroys the view itself, so this file no longer
 * constructs one; it waits for `arcgisViewReadyChange` and hands the live view to
 * `createMapController`, which attaches the app's layers, watchers and time
 * slider to it. Home, Legend, Scale Bar and Search are slotted children: they
 * need the map element as their parent for layout and theming.
 */
export function MapContainer({
  basemap,
  hasApiKey,
  visibility,
  onStatusChange,
  onExtentStats,
  onReady,
  timeStripOpen,
  onIssFix,
  initialCenter,
  initialZoom,
}: MapContainerProps) {
  const timeStripRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<MapController | null>(null)
  const [layers, setLayers] = useState<readonly AppLayer[]>([])
  // Mounting the element on the next macrotask keeps StrictMode's mount →
  // unmount → remount from ever connecting a map: the first pass is cancelled
  // before the element exists, so exactly one view is built and nothing is
  // aborted mid-load.
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setMapReady(true), 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  const attach = useCallback(
    (event: Event) => {
      const element = event.currentTarget as ArcgisMap
      const view = element.view
      if (!view) return
      // A remount can hand over a fresh view; the old controller belongs to the
      // destroyed one, so release it before attaching again.
      if (controllerRef.current) {
        if (controllerRef.current.view === view) return
        controllerRef.current.dispose()
        controllerRef.current = null
      }

      const strip = timeStripRef.current
      // Imperative wrapper: the controller appends and removes the slider
      // element inside it, and React never reconciles the strip's children.
      const host = strip ? document.createElement('div') : null
      if (host && strip) {
        host.className = 'time-slider-host'
        strip.append(host)
      }

      const controller = createMapController({
        view,
        onStatusChange,
        onExtentStats,
        timeSliderHost: host,
        onIssFix,
        // The EONET layer arrives after startup; React must learn about it so
        // visibility toggles and extent counts apply to it too.
        onLayersChanged: setLayers,
      })
      controllerRef.current = controller
      onReady?.(controller)
      setLayers(controller.layers)
    },
    [onStatusChange, onExtentStats, onIssFix, onReady],
  )

  useEffect(
    () => () => {
      controllerRef.current?.dispose()
      controllerRef.current = null
    },
    [],
  )

  useEffect(() => {
    for (const layer of layers) {
      const on = visibility[layer.id as LayerId]
      if (on !== undefined)
        // oxlint-disable-next-line react/immutability
        layer.visible = on
    }
    // Counts only cover visible layers, so refresh after toggling.
    controllerRef.current?.refreshExtentStats()
  }, [layers, visibility])

  return (
    <div className="map-area">
      <div
        className="map-root"
        role="application"
        aria-label="Interactive world map showing recent earthquakes and hurricanes"
      >
        {mapReady && (
          // Basemap and the initial extent are element properties, so React
          // applies them; nothing imperatively reassigns `map.basemap`.
          <arcgis-map
            basemap={basemap}
            center={initialCenter ?? CONUS_CENTER}
            zoom={initialZoom ?? DEFAULT_ZOOM}
            onarcgisViewReadyChange={attach}
          >
            <arcgis-home slot="top-left" />
            <arcgis-zoom slot="top-left" />
            {/* The World Geocoder behind Search needs an API key. */}
            {hasApiKey && <arcgis-search slot="top-left" />}
            <arcgis-legend slot="bottom-left" />
            <arcgis-scale-bar slot="bottom-left" unit="dual" />
          </arcgis-map>
        )}
      </div>
      {/* Toggled via [hidden] rather than unmounted so the slider keeps its host
          and its window while the strip is collapsed. */}
      <div ref={timeStripRef} id="time-strip" className="time-strip" hidden={!timeStripOpen} />
    </div>
  )
}
