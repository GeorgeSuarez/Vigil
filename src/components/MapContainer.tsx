import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import { useEffect, useRef, useState } from 'react'
import {
  createCityView,
  type CityView,
  type ExtentStats,
  type ViewStatus,
} from '../lib/createCityView'
import type { LayerId } from '../lib/layers'

export interface MapContainerProps {
  basemap: string
  apiKey: string
  visibility: Record<LayerId, boolean>
  onStatusChange: (status: ViewStatus) => void
  onExtentStats: (stats: ExtentStats) => void
  initialCenter?: [number, number]
  initialZoom?: number
}

/**
 * Owns the MapView lifecycle. The view is created once on mount (and destroyed
 * on unmount, which keeps React StrictMode's double-effect safe); props are
 * applied imperatively so they never recreate the map.
 */
export function MapContainer({
  basemap,
  apiKey,
  visibility,
  onStatusChange,
  onExtentStats,
  initialCenter,
  initialZoom,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const timeStripRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<CityView | null>(null)
  const [layers, setLayers] = useState<readonly FeatureLayer[]>([])

  useEffect(() => {
    const container = containerRef.current
    const strip = timeStripRef.current
    if (!container || !strip) return
    // Imperative host node: created and owned outside React so the widget's
    // DOM survives StrictMode's double-mount and later reconciliations.
    const host = document.createElement('div')
    host.className = 'time-slider-host'
    strip.appendChild(host)
    const city = createCityView({
      container,
      basemap,
      apiKey,
      onStatusChange,
      onExtentStats,
      initialCenter,
      initialZoom,
      timeSliderHost: host,
    })
    viewRef.current = city
    setLayers(city.layers)
    return () => {
      city.timeSlider?.destroy()
      city.view.destroy()
      host.remove()
      viewRef.current = null
    }
    // The view is created once; basemap and layer changes are synced imperatively.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = viewRef.current?.view.map
    if (!map) return
    // Imperative SDK interop: the basemap lives on the map object, not in React state.
    // oxlint-disable-next-line react/immutability
    map.basemap = basemap
  }, [basemap])

  useEffect(() => {
    for (const layer of layers) {
      const on = visibility[layer.id as LayerId]
      if (on !== undefined)
        // oxlint-disable-next-line react/immutability
        layer.visible = on
    }
    // Counts only cover visible layers, so refresh after toggling.
    viewRef.current?.refreshExtentStats()
  }, [layers, visibility])

  return (
    <div className="map-area">
      <div ref={containerRef} className="map-root" />
      {/* Empty to React — the widget host is created imperatively in the effect. */}
      <div ref={timeStripRef} className="time-strip" />
    </div>
  )
}
