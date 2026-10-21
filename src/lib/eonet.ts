/**
 * EONET (NASA natural events) ingestion.
 *
 * The feed's GeoJSON properties are partially non-scalar: `categories` and
 * `sources` are arrays of objects. GeoJSONLayer infers field types from the
 * data and silently DROPS such properties, so a renderer expression like
 * `$feature.categories[0].title` evaluates to null for every feature and the
 * whole layer falls back to the default symbol. Flattening the properties to
 * scalars before the layer sees them is what makes categorical symbology work.
 */

export const EONET_FEED_URL =
  'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?days=30&status=open'

/** One point event, flattened to scalars the layer can type and style. */
export interface EonetEventProperties {
  eventId: string | null
  title: string | null
  /** EONET API record URL; ends in /geojson. */
  link: string | null
  /** Epoch milliseconds of the event's latest geometry. */
  dateMs: number | null
  magnitudeValue: number | null
  magnitudeUnit: string | null
  /** Category title, e.g. "Wildfires" — the renderer's style field. */
  category: string | null
  categoryId: string | null
  sourceName: string | null
  sourceUrl: string | null
}

export interface EonetFeatureCollection {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: EonetEventProperties
  }[]
}

/** Shape of one raw feed feature (only the parts we read). */
interface RawFeature {
  geometry?: { type?: string; coordinates?: unknown } | null
  properties?: {
    id?: unknown
    title?: unknown
    link?: unknown
    date?: unknown
    magnitudeValue?: unknown
    magnitudeUnit?: unknown
    categories?: { id?: unknown; title?: unknown }[] | null
    sources?: { id?: unknown; url?: unknown }[] | null
  } | null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function epochMs(value: unknown): number | null {
  const iso = text(value)
  if (!iso) return null
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * Flattens a raw EONET FeatureCollection into point features with scalar
 * properties. Non-point geometries (the feed includes storm-track LineStrings)
 * are dropped, and features without usable coordinates are skipped.
 */
export function flattenEonetEvents(raw: unknown): EonetFeatureCollection {
  const features: EonetFeatureCollection['features'] = []
  const rawFeatures = (raw as { features?: unknown } | null)?.features
  if (!Array.isArray(rawFeatures)) return { type: 'FeatureCollection', features }

  for (const entry of rawFeatures as RawFeature[]) {
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
    const category = p.categories?.[0]
    const source = p.sources?.[0]
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coords[0] as number, coords[1] as number] },
      properties: {
        eventId: text(p.id),
        title: text(p.title),
        link: text(p.link),
        dateMs: epochMs(p.date),
        magnitudeValue: finite(p.magnitudeValue),
        magnitudeUnit: text(p.magnitudeUnit),
        category: text(category?.title),
        categoryId: text(category?.id),
        sourceName: text(source?.id),
        sourceUrl: text(source?.url),
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

/**
 * Serialises the flattened collection as a data URL. Null properties are
 * omitted to keep the payload small — a data URL is the only way to hand
 * in-memory GeoJSON to a GeoJSONLayer at construction, and the SDK never
 * reloads a layer whose `url` changes after it has loaded.
 */
export function toEonetDataUrl(collection: EonetFeatureCollection): string {
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
