/**
 * Shareable URL state for the map, encoded in the location hash so links can
 * be pasted anywhere. Kept pure and SDK-free so it is fully unit-testable.
 *
 * Format: `#b=<basemap>&c=<lon>,<lat>&z=<zoom>&l=<visibleLayerIds>`
 * Example: `#b=topo&c=-122.4194,37.7749&z=12&l=earthquakes,storms`
 */

export interface UrlState {
  basemap: string
  /** WGS84 position as [longitude, latitude] — same order as MapView's center. */
  center: [number, number]
  zoom: number
  /** Ids of visible layers; ids not listed are treated as hidden. */
  visibleLayers: string[]
}

/** Every field is optional: parse only reports what the hash contained, valid or not. */
export type ParsedUrlState = Partial<UrlState>

export interface ParseUrlStateOptions {
  /** When provided, unknown basemap ids are dropped instead of kept. */
  knownBasemaps?: readonly string[]
  /** When provided, unknown layer ids are dropped from visibleLayers. */
  knownLayerIds?: readonly string[]
}

const HASH_PREFIX = /^#/

function parseCenter(raw: string | null): [number, number] | undefined {
  if (!raw) return undefined
  const parts = raw.split(',')
  if (parts.length !== 2) return undefined
  const lon = Number(parts[0])
  const lat = Number(parts[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return undefined
  return [lon, lat]
}

function parseZoom(raw: string | null): number | undefined {
  if (!raw) return undefined
  const zoom = Number(raw)
  if (!Number.isFinite(zoom)) return undefined
  return Math.min(Math.max(zoom, 1), 20)
}

function parseLayerList(
  raw: string | null,
  knownLayerIds?: readonly string[],
): string[] | undefined {
  if (raw === null) return undefined
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (!knownLayerIds) return ids
  const known = new Set(knownLayerIds)
  return ids.filter((id) => known.has(id))
}

/** Parses a location hash string (with or without the leading `#`). */
export function parseUrlState(hash: string, options: ParseUrlStateOptions = {}): ParsedUrlState {
  const params = new URLSearchParams(hash.replace(HASH_PREFIX, ''))
  const basemapRaw = params.get('b')
  const basemap =
    basemapRaw && (!options.knownBasemaps || options.knownBasemaps.includes(basemapRaw))
      ? basemapRaw
      : undefined

  const result: ParsedUrlState = {}
  const basemapValue = basemap ?? undefined
  if (basemapValue) result.basemap = basemapValue

  const center = parseCenter(params.get('c'))
  if (center) result.center = center

  const zoom = parseZoom(params.get('z'))
  if (zoom !== undefined) result.zoom = zoom

  const visibleLayers = parseLayerList(params.get('l'), options.knownLayerIds)
  if (visibleLayers) result.visibleLayers = visibleLayers

  return result
}

/** Serializes map state to a hash string (without the leading `#`). */
export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams()
  params.set('b', state.basemap)
  params.set('c', `${state.center[0].toFixed(4)},${state.center[1].toFixed(4)}`)
  params.set('z', String(Number(state.zoom.toFixed(2))))
  if (state.visibleLayers.length > 0) {
    params.set('l', state.visibleLayers.join(','))
  }
  return params.toString()
}
