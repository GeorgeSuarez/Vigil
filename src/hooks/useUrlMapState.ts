import { useEffect, useMemo, useRef, useState } from 'react'
import type { ViewStatus } from '../lib/createMapController'
import { BASEMAP_OPTIONS } from '../lib/basemaps'
import { LAYER_DESCRIPTORS } from '../lib/layers'
import { parseUrlState, serializeUrlState } from '../lib/urlState'
import { useLayerVisibility } from './useLayerVisibility'

const HASH_WRITE_DELAY_MS = 300

/**
 * Map state (basemap, layer visibility) with URL-hash persistence: restored
 * from the hash once on mount, mirrored back debounced as it or the view
 * state changes.
 */
export function useUrlMapState(status: ViewStatus): {
  basemap: string
  setBasemap: (value: string) => void
  visibility: Record<string, boolean>
  toggleVisibility: (id: string, visible: boolean) => void
  initialCenter: [number, number] | undefined
  initialZoom: number | undefined
} {
  // Shared map state is restored from the URL hash once on mount.
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

  // Mirror live state back into the hash. Debounced and written via
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

  return {
    basemap,
    setBasemap,
    visibility,
    toggleVisibility,
    initialCenter: initial.center,
    initialZoom: initial.zoom,
  }
}
