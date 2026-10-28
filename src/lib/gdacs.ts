/**
 * GDACS tropical cyclones (Global Disaster Alert and Coordination System).
 *
 * GDACS is the global aggregator, so it carries the Western Pacific typhoons that
 * NHC does not cover, and its API allows cross-origin requests (`ACAO: *`) —
 * unlike NHC's `CurrentStorms.json`, which needs a proxy.
 *
 * Its GeoJSON properties are nested objects (`severitydata`, `url`). A
 * GeoJSONLayer infers field types from the data and silently drops such
 * properties, which would leave the renderer and popup reading nulls — the same
 * trap EONET has, so the feed is flattened to scalars first.
 */

export const GDACS_STORMS_URL =
  'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventtype=TC'

/** One storm, flattened to the scalars the layer can type and style. */
export interface StormProperties {
  eventId: number | null
  /** e.g. "CHAMPI-26". */
  name: string | null
  /** "Red" | "Orange" | "Green" — the renderer's style field. */
  alertLevel: string | null
  /** Maximum sustained wind, km/h. */
  windKmh: number | null
  /** GDACS severity sentence, e.g. "Hurricane/Typhoon > 74 mph (max 296 km/h)". */
  severityText: string | null
  /** Comma-separated affected countries. */
  countries: string | null
  /** Epoch milliseconds of the last GDACS update. */
  dateMs: number | null
  /** Human-readable GDACS report page. */
  reportUrl: string | null
  /** Per-storm geometry endpoint: current position plus wind-radii polygons. */
  trackUrl: string | null
}

export interface StormFeatureCollection {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: StormProperties
  }[]
}

interface RawStormFeature {
  geometry?: { type?: string; coordinates?: unknown } | null
  properties?: {
    eventid?: unknown
    eventname?: unknown
    name?: unknown
    alertlevel?: unknown
    datemodified?: unknown
    country?: unknown
    severitydata?: { severity?: unknown; severitytext?: unknown } | null
    url?: { report?: unknown; geometry?: unknown } | null
  } | null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function finite(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function epochMs(value: unknown): number | null {
  const iso = text(value)
  if (!iso) return null
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : null
}

/** Flattens GDACS storm features; non-point geometries and bad coordinates drop. */
export function flattenGdacsStorms(raw: unknown): StormFeatureCollection {
  const features: StormFeatureCollection['features'] = []
  const rawFeatures = (raw as { features?: unknown } | null)?.features
  if (!Array.isArray(rawFeatures)) return { type: 'FeatureCollection', features }

  for (const entry of rawFeatures as RawStormFeature[]) {
    const geometry = entry?.geometry
    if (geometry?.type !== 'Point') continue
    const coords = geometry.coordinates
    if (
      !Array.isArray(coords) ||
      coords.length < 2 ||
      !Number.isFinite(coords[0]) ||
      !Number.isFinite(coords[1])
    ) {
      continue
    }
    const p = entry.properties ?? {}
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coords[0] as number, coords[1] as number] },
      properties: {
        eventId: finite(p.eventid),
        name: text(p.eventname) ?? text(p.name),
        alertLevel: text(p.alertlevel),
        windKmh: finite(p.severitydata?.severity),
        severityText: text(p.severitydata?.severitytext),
        countries: text(p.country),
        dateMs: epochMs(p.datemodified),
        reportUrl: text(p.url?.report),
        trackUrl: text(p.url?.geometry),
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

/** Serialises the flattened collection as a data URL, dropping null properties. */
export function toStormDataUrl(collection: StormFeatureCollection): string {
  const compact = {
    type: 'FeatureCollection' as const,
    features: collection.features.map((feature) => ({
      type: 'Feature' as const,
      geometry: feature.geometry,
      properties: Object.fromEntries(
        Object.entries(feature.properties).filter(([, value]) => value !== null),
      ),
    })),
  }
  return `data:application/geo+json,${encodeURIComponent(JSON.stringify(compact))}`
}

/** Fetches and flattens the live storm list. Null on any failure. */
export async function loadGdacsStorms(): Promise<StormFeatureCollection | null> {
  try {
    const res = await fetch(GDACS_STORMS_URL)
    if (!res.ok) return null
    return flattenGdacsStorms(await res.json())
  } catch {
    return null
  }
}

/** One storm's track and wind-radii geometry, as GeoJSON features. */
export interface StormTrack {
  type: 'FeatureCollection'
  features: unknown[]
}

/**
 * Fetches a single storm's track/wind-radii polygons.
 *
 * Fetched here rather than handed straight to a GeoJSONLayer on purpose: GDACS
 * times out under load, and a failing layer logs a `#load() Failed to load layer`
 * error from inside the SDK. Resolving to null keeps a slow feed quiet, and the
 * caller can drop the extra layer without a console error appearing.
 */
export async function loadStormTrack(url: string): Promise<StormTrack | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const raw = (await res.json()) as { features?: unknown }
    if (!Array.isArray(raw.features)) return null
    return { type: 'FeatureCollection', features: raw.features }
  } catch {
    return null
  }
}

/** Serialises a track as a data URL, keeping geometry only — the polygons are
 * drawn, never queried, so their properties are dead weight. */
export function toTrackDataUrl(track: StormTrack): string {
  const features = track.features.map((feature) => {
    const { geometry } = feature as { geometry?: unknown }
    return { type: 'Feature' as const, geometry }
  })
  return `data:application/geo+json,${encodeURIComponent(
    JSON.stringify({ type: 'FeatureCollection' as const, features }),
  )}`
}
