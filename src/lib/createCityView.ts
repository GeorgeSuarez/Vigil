import Map from '@arcgis/core/Map'
import MapView from '@arcgis/core/views/MapView'
import Home from '@arcgis/core/widgets/Home'
import Legend from '@arcgis/core/widgets/Legend'
import ScaleBar from '@arcgis/core/widgets/ScaleBar'
import Search from '@arcgis/core/widgets/Search'
import TimeSlider from '@arcgis/core/widgets/TimeSlider'
import { configureArcgisSdk } from './arcgis'
import { buildFeatureLayers, type AppLayer } from './layers'

/** Snapshot of view state surfaced in the status bar. */
export interface ViewStatus {
  zoom: number | null
  scale: number | null
  lat: number | null
  lon: number | null
}

/** Feature counts per layer id, computed against the current view extent. */
export type ExtentStats = Record<string, number>

export interface CreateCityViewOptions {
  container: HTMLDivElement
  basemap: string
  apiKey: string
  onStatusChange: (status: ViewStatus) => void
  onExtentStats: (stats: ExtentStats) => void
  /** Initial center as [lon, lat]; falls back to the contiguous US. */
  initialCenter?: [number, number]
  initialZoom?: number
  /** Host element for the TimeSlider; omitted when the UI has no time strip. */
  timeSliderHost?: HTMLDivElement | null
}

export interface CityView {
  view: MapView
  layers: readonly AppLayer[]
  /** Recomputes view-extent stats; call after layer visibility changes. */
  refreshExtentStats: () => void
  /** Null when no time slider host was provided. */
  timeSlider: TimeSlider | null
}

/** Contiguous US center used for the initial extent. */
const CONUS_CENTER: [number, number] = [-98.5, 39.8]
const DEFAULT_ZOOM = 4

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
  onExtentStats,
  initialCenter,
  initialZoom,
  timeSliderHost,
}: CreateCityViewOptions): CityView {
  configureArcgisSdk(apiKey)

  const layers = buildFeatureLayers()
  const map = new Map({ basemap, layers })
  const view = new MapView({
    container,
    map,
    center: initialCenter ?? CONUS_CENTER,
    zoom: initialZoom ?? DEFAULT_ZOOM,
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

  // --- View-extent feature counts -------------------------------------------
  // Each trigger bumps a token; only the latest run's results are delivered,
  // so responses from aborted pans can never overwrite fresh ones.
  let statsRun = 0

  const refreshExtentStats = (): void => {
    const extent = view.extent
    if (!extent) return
    const run = ++statsRun
    const counts: Record<string, number> = {}
    const queries = layers
      .filter((layer) => layer.visible)
      .map((layer) =>
        layer
          .queryFeatureCount({ geometry: extent, timeExtent: view.timeExtent })
          .then((count) => {
            counts[layer.id] = count
          })
          .catch(() => {
            // Service hiccups leave the layer out of this round of stats.
          }),
      )
    void Promise.all(queries).then(() => {
      if (run === statsRun) onExtentStats(counts)
    })
  }

  view.watch('timeExtent', () => refreshExtentStats())
  view.when(() => {
    refreshExtentStats()
    view.watch('stationary', (stationary) => {
      if (stationary) refreshExtentStats()
    })
  })

  // --- Time slider -------------------------------------------------------------
  // The live USGS quakes layer declares timeInfo (startField: 'time', epoch
  // ms). The slider's full range comes from the layer's advertised time extent
  // when the service publishes one, otherwise it is derived from the data with
  // ordered client-side queries. With `view` set, the widget updates
  // view.timeExtent automatically, which filters time-aware layers.
  let timeSlider: TimeSlider | null = null
  const quakeLayer = layers.find((layer) => layer.id === 'earthquakes')

  if (timeSliderHost && quakeLayer) {
    timeSlider = new TimeSlider({ container: timeSliderHost, mode: 'time-window', view })

    const deriveTimeRange = async (): Promise<{ start: Date; end: Date } | null> => {
      const ti = quakeLayer.timeInfo
      if (!ti) return null
      const advertised = ti.fullTimeExtent
      if (advertised?.start && advertised?.end) {
        return { start: advertised.start, end: advertised.end }
      }
      // Client-declared timeInfo has no advertised extent — derive it from data.
      try {
        const asc = await quakeLayer.queryFeatures({
          outFields: ['time'],
          orderByFields: ['time ASC'],
          num: 1,
          returnGeometry: false,
        })
        const desc = await quakeLayer.queryFeatures({
          outFields: ['time'],
          orderByFields: ['time DESC'],
          num: 1,
          returnGeometry: false,
        })
        const start = asc.features[0]?.attributes?.time
        const end = desc.features[0]?.attributes?.time
        if (typeof start === 'number' && typeof end === 'number') {
          return { start: new Date(start), end: new Date(end) }
        }
      } catch {
        // Service hiccup — no range this round; the slider stays as-is.
      }
      return null
    }

    let lastKnownEnd: Date | null = null
    const applyRange = async (): Promise<void> => {
      if (!timeSlider) return
      const range = await deriveTimeRange()
      if (!range || quakeLayer.destroyed || !timeSlider) return
      timeSlider.fullTimeExtent = { start: range.start, end: range.end }
      if (quakeLayer.timeInfo) {
        quakeLayer.timeInfo.fullTimeExtent = { start: range.start, end: range.end }
      }
      // Track the newest data automatically, but never shrink a window the
      // user has deliberately narrowed away from the leading edge.
      const atLeadingEdge =
        lastKnownEnd === null ||
        (timeSlider.timeExtent?.end && lastKnownEnd
          ? timeSlider.timeExtent.end.getTime() >= lastKnownEnd.getTime()
          : false)
      if (atLeadingEdge) {
        timeSlider.timeExtent = {
          start: timeSlider.timeExtent?.start ?? range.start,
          end: range.end,
        }
      }
      lastKnownEnd = range.end
    }

    void quakeLayer.when(() => {
      void applyRange()
    })
    // Feed refreshes slide the data forward; stats and the slider follow.
    quakeLayer.on('refresh', () => {
      refreshExtentStats()
      void applyRange()
    })
  }

  view.ui.add(new Home({ view }), 'top-left')

  // The Search widget calls the ArcGIS World Geocoder, which requires an API key.
  if (apiKey) {
    view.ui.add(new Search({ view }), 'top-left')
  }

  view.ui.add(new Legend({ view }), 'bottom-left')
  view.ui.add(new ScaleBar({ view, unit: 'dual' }), 'bottom-left')

  return { view, layers, refreshExtentStats, timeSlider }
}
