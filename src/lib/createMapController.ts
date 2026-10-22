import type MapView from '@arcgis/core/views/MapView'
import Point from '@arcgis/core/geometry/Point'
import TimeExtent from '@arcgis/core/time/TimeExtent'
import FeatureFilter from '@arcgis/core/layers/support/FeatureFilter'
import { watch } from '@arcgis/core/core/reactiveUtils'
import '@arcgis/map-components/components/arcgis-time-slider'
import type { ArcgisTimeSlider } from '@arcgis/map-components/components/arcgis-time-slider'
import { adoptTimeSliderStyles } from './timeSliderStyles'
import {
  buildFeatureLayers,
  createEonetLayer,
  loadEonetEvents,
  startIssTracking,
  LAYER_DESCRIPTORS,
  type AppLayer,
  type FeatureLayer,
  type GeoJSONLayer,
  type GraphicsLayer,
} from './layers'

/** Snapshot of view state surfaced in the status bar. */
export interface ViewStatus {
  zoom: number | null
  scale: number | null
  lat: number | null
  lon: number | null
}

/** Feature counts per layer id, computed against the current view extent. */
export type ExtentStats = Record<string, number>

export interface CreateMapControllerOptions {
  /** The live view, owned by the `<arcgis-map>` element that renders it. */
  view: MapView
  onStatusChange: (status: ViewStatus) => void
  onExtentStats: (stats: ExtentStats) => void
  /** Host element for the TimeSlider; omitted when the UI has no time strip. */
  timeSliderHost?: HTMLDivElement | null
  /** Fires once the first ISS position has landed. */
  onIssFix?: () => void
  /** Notifies React when a layer is added after startup (the EONET feed). */
  onLayersChanged?: (layers: readonly AppLayer[]) => void
}

export interface MapController {
  view: MapView
  layers: readonly AppLayer[]
  /** Recomputes view-extent stats; call after layer visibility changes. */
  refreshExtentStats: () => void
  /** Applies a SQL where-clause to the quakes layer (render + queries). */
  applyQuakeFilter: (where: string | null) => void
  /** Releases the temporal filter: resets the slider to the full extent. */
  resetTimeWindow: () => void
  /** Flies the view to the station's latest polled position. Returns false
   * when no fix has arrived yet (nothing to fly to). */
  locateIss: () => boolean
  /** Null when no time slider host was provided. */
  timeSlider: ArcgisTimeSlider | null
  /** Stops the controller's own subscriptions and removes the slider element.
   * The view itself belongs to `<arcgis-map>`, which destroys it on unmount. */
  dispose: () => void
}

/** Contiguous US center used when the URL carries no view state. */
export const CONUS_CENTER: [number, number] = [-98.5, 39.8]
export const DEFAULT_ZOOM = 4
/** Close enough to see the station against its ground track. */
const ISS_FOCUS_ZOOM = 6

/** Layers that are data services — the stats/query pipeline — versus the
 * graphics layer, which is render-only (the live ISS marker). */
type QueryableLayer = FeatureLayer | GeoJSONLayer

function isQueryableLayer(layer: AppLayer): layer is QueryableLayer {
  return layer.type !== 'graphics'
}

/** Throttles status updates to one per animation frame. */
function startViewportTracking(view: MapView, onStatusChange: (status: ViewStatus) => void): void {
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
  watch(() => view.zoom, notify)
  watch(() => view.scale, notify)
  watch(() => view.center, notify)
  // The view arrives ready (the `<arcgis-map>` element created and positioned
  // it), so the watchers see no change to announce — emit the first snapshot
  // ourselves or the status bar sits on em dashes until the user pans.
  notify()
}

/**
 * Feature counts per layer, computed against the current view extent. Each
 * trigger bumps a token; only the latest run's results are delivered, so
 * responses from aborted pans can never overwrite fresh ones.
 */
function startExtentCounts(
  view: MapView,
  layers: readonly AppLayer[],
  onExtentStats: (stats: ExtentStats) => void,
): { refresh: () => void } {
  let statsRun = 0
  const refresh = (): void => {
    const extent = view.extent
    if (!extent) return
    const run = ++statsRun
    const counts = new Map<string, number>()
    const queries: Promise<unknown>[] = []
    for (const layer of layers) {
      // The graphics layer (ISS) is a live marker, not a data service — it
      // never contributes counts.
      if (!layer.visible || !isQueryableLayer(layer)) continue
      // Merge the layer's runtime expression explicitly: the engine
      // bypasses layer-level definitionExpression when the query object
      // carries geometry/timeExtent args (pinned by integration tests).
      const id = layer.id
      queries.push(
        layer
          .queryFeatureCount({
            geometry: extent,
            timeExtent: view.timeExtent,
            where: layer.definitionExpression ?? '1=1',
          })
          .then((count) => {
            counts.set(id, count)
          })
          .catch(() => {
            // Service hiccups leave the layer out of this round of stats.
          }),
      )
    }
    void Promise.all(queries).then(() => {
      if (run === statsRun) onExtentStats(Object.fromEntries(counts))
    })
  }

  watch(
    () => view.timeExtent,
    () => refresh(),
  )
  view.when(() => {
    refresh()
    watch(
      () => view.stationary,
      (stationary) => {
        if (stationary) refresh()
      },
    )
  })
  return { refresh }
}

/**
 * Quake filtering. The engine honors layer-level definitionExpression on
 * un-argued queries, but bypasses it when the query object carries
 * geometry/timeExtent (see the integration tests), so the render side is
 * driven explicitly via layerView.filter, which also handles clustered layers.
 */
function startQuakeFiltering(
  view: MapView,
  quakeLayer: QueryableLayer | undefined,
  refreshExtentStats: () => void,
): (where: string | null) => void {
  const quakeLayerViewPromise = quakeLayer ? view.whenLayerView(quakeLayer) : null
  return (where) => {
    if (!quakeLayer) return
    // oxlint-disable-next-line react/immutability
    quakeLayer.definitionExpression = where
    void quakeLayerViewPromise?.then((layerView) => {
      if (quakeLayer.destroyed) return
      // oxlint-disable-next-line react/immutability
      layerView.filter = where ? new FeatureFilter({ where }) : null
      // Force the clustered store to re-index with the new filter (the engine
      // otherwise keeps serving the pre-filter cluster state).
      const reduction = quakeLayer.featureReduction
      // oxlint-disable-next-line react/immutability
      quakeLayer.featureReduction = null
      // oxlint-disable-next-line react/immutability
      quakeLayer.featureReduction = reduction
    })
    refreshExtentStats()
  }
}

/** Queries the layer's declared or observed time span: the advertised
 * fullTimeExtent when the service publishes one, otherwise the earliest and
 * latest epoch values in the data itself. */
async function deriveTimeRange(
  quakeLayer: QueryableLayer,
): Promise<{ start: Date; end: Date } | null> {
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
    // Decoded at the SDK I/O boundary: query attributes are untyped, so the
    // runtime check is what confirms the field really is an epoch number.
    // pi-lens-ignore: no-runtime-typeof
    if (typeof start === 'number' && typeof end === 'number') {
      return { start: new Date(start), end: new Date(end) }
    }
  } catch {
    // Service hiccup — no range this round; the slider stays as-is.
  }
  return null
}

/** Whether the window still ends at the newest data, and so should follow it
 * as the feed refreshes. */
function atLeadingEdge(timeSlider: ArcgisTimeSlider, lastKnownEnd: Date | null): boolean {
  if (lastKnownEnd === null) return true
  const end = timeSlider.timeExtent?.end
  if (!end) return false
  return end.getTime() >= lastKnownEnd.getTime()
}

/**
 * Creates the `<arcgis-time-slider>` component in the strip and keeps its range
 * in step with the live feed.
 *
 * The component replaces the deprecated widget so nothing in the app logs a
 * deprecation, and it renders the same TimeSlider DOM — just inside a shadow
 * root, which is what `adoptTimeSliderStyles` exists for.
 */
function startTimeSlider(
  view: MapView,
  host: HTMLDivElement,
  quakeLayer: QueryableLayer,
  refreshExtentStats: () => void,
): ArcgisTimeSlider {
  const timeSlider = document.createElement('arcgis-time-slider')
  timeSlider.mode = 'time-window'
  host.append(timeSlider)
  timeSlider.view = view
  adoptTimeSliderStyles(timeSlider)

  let lastKnownEnd: Date | null = null
  let disposed = false

  const applyRange = async (): Promise<void> => {
    if (disposed) return
    const range = await deriveTimeRange(quakeLayer)
    if (!range || quakeLayer.destroyed || disposed) return
    // oxlint-disable-next-line react/immutability
    timeSlider.fullTimeExtent = new TimeExtent({ start: range.start, end: range.end })
    if (quakeLayer.timeInfo) {
      // oxlint-disable-next-line react/immutability
      quakeLayer.timeInfo.fullTimeExtent = { start: range.start, end: range.end }
    }
    // Track the newest data automatically, but never shrink a window the
    // user has deliberately narrowed away from the leading edge.
    if (atLeadingEdge(timeSlider, lastKnownEnd)) {
      // oxlint-disable-next-line react/immutability
      timeSlider.timeExtent = new TimeExtent({
        start: timeSlider.timeExtent?.start ?? range.start,
        end: range.end,
      })
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

  // Detaching the element is what destroys the widget; flag it first so an
  // in-flight range update cannot write to a detached component.
  const markDisposed = (): void => {
    disposed = true
  }
  timeSlider.addEventListener('arcgisReady', () => {
    timeSlider.addEventListener('arcgisPropertyChange', markDisposed, { once: true })
  })

  return timeSlider
}

/**
 * Framework-agnostic factory that wires the map, demo layers, and widgets.
 * React owns the lifecycle in MapContainer; everything SDK-specific lives here
 * so it can be swapped or mocked without touching UI code.
 */
export function createMapController({
  view,
  onStatusChange,
  onExtentStats,
  timeSliderHost,
  onIssFix,
  onLayersChanged,
}: CreateMapControllerOptions): MapController {
  const map = view.map
  if (!map) throw new Error('<arcgis-map> handed over a view without a map')
  const layers = buildFeatureLayers()
  map.addMany(layers)

  startViewportTracking(view, onStatusChange)
  const { refresh: refreshExtentStats } = startExtentCounts(view, layers, onExtentStats)

  const quakeLayer = layers.find(
    (layer): layer is QueryableLayer => isQueryableLayer(layer) && layer.id === 'earthquakes',
  )

  // Kick off the live ISS poll; it self-cleans when the layer is destroyed.
  const issLayer = layers.find(
    (layer): layer is GraphicsLayer => layer.type === 'graphics' && layer.id === 'iss',
  )
  for (const layer of layers) {
    if (layer.type !== 'graphics') continue
    const feedUrl = LAYER_DESCRIPTORS.find((d) => d.id === layer.id)?.url
    if (feedUrl) startIssTracking(layer, feedUrl, onIssFix)
  }

  // EONET's feed cannot back a layer directly (its object-valued properties are
  // dropped on load) and a layer never reloads once loaded — so the layer is
  // created from flattened data and added when that data arrives.
  void loadEonetEvents().then((collection) => {
    const descriptor = LAYER_DESCRIPTORS.find((d) => d.kind === 'eonet')
    if (!collection || !descriptor || view.destroyed) return
    const eonetLayer = createEonetLayer(descriptor, collection)
    map.add(eonetLayer)
    layers.push(eonetLayer)
    onLayersChanged?.([...layers])
    refreshExtentStats()
  })

  const applyQuakeFilter = startQuakeFiltering(view, quakeLayer, refreshExtentStats)

  const timeSlider =
    timeSliderHost && quakeLayer
      ? startTimeSlider(view, timeSliderHost, quakeLayer, refreshExtentStats)
      : null

  // Home, Legend, Scale Bar and Search are slotted `<arcgis-*>` components in
  // MapContainer: they need the map element as their parent for layout and
  // theming, which is why nothing here touches view.ui any more.

  // Flies to the station's current position. Returns false before the first
  // poll, so the caller can leave its affordance disabled until there is
  // somewhere to fly to.
  const locateIss = (): boolean => {
    const geometry = issLayer?.graphics.getItemAt(0)?.geometry
    // The marker is always a Point; the SDK types graphic geometry as a union.
    if (!(geometry instanceof Point)) return false
    void view.goTo({ center: geometry, zoom: ISS_FOCUS_ZOOM }).catch(() => {
      // View destroyed mid-flight (StrictMode remount) — nothing to do.
    })
    return true
  }

  // Collapsing the strip takes away the only visible time control, so the app
  // releases the temporal filter rather than leaving the map silently filtered.
  const resetTimeWindow = (): void => {
    const full = timeSlider?.fullTimeExtent
    if (!timeSlider || !full) return
    // oxlint-disable-next-line react/immutability
    timeSlider.timeExtent = new TimeExtent({
      start: full.start ?? undefined,
      end: full.end ?? undefined,
    })
  }

  // The view belongs to `<arcgis-map>`, which destroys it (and every layer with
  // it) on unmount; the controller only releases what it created itself.
  const dispose = (): void => {
    timeSlider?.remove()
  }

  return {
    view,
    layers,
    refreshExtentStats,
    applyQuakeFilter,
    resetTimeWindow,
    locateIss,
    timeSlider,
    dispose,
  }
}
