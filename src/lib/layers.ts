import PopupTemplate from '@arcgis/core/PopupTemplate'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import MapImageLayer from '@arcgis/core/layers/MapImageLayer'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer'
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer'
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol'
import TimeInfo from '@arcgis/core/layers/support/TimeInfo'
import { formatEpoch, formatNullable } from './format'
import { saffirSimpson } from './hurricane'
import {
  GDACS_STORMS_URL,
  toStormDataUrl,
  toTrackDataUrl,
  type StormFeatureCollection,
  type StormProperties,
  type StormTrack,
} from './gdacs'
import { ICON_PATHS, ICON_OUTLINE_COLOR, ICON_SIZE } from './icons'
import {
  EONET_FEED_URL,
  flattenEonetEvents,
  toEonetDataUrl,
  type EonetFeatureCollection,
} from './eonet'

export type { FeatureLayer }
export type { GeoJSONLayer }
export type { GraphicsLayer }
export type { MapImageLayer }

/** Concrete layer types used by the app. Feature layers power popups,
 * renderers, and stats queries; the graphics layer hosts the ISS marker; the
 * map image layer draws NHC's forecast cones, whose symbology is server-side. */
export type AppLayer = FeatureLayer | GeoJSONLayer | MapImageLayer | GraphicsLayer

/** Static, testable description of a dataset shown in the layer panel. */
export interface LayerDescriptor {
  id: string
  title: string
  /** Compact label for tight UI contexts (e.g. the status bar). */
  shortTitle: string
  description: string
  /** Where the layer's data comes from — decides which factory recipe builds it. */
  kind: 'geojson' | 'mapimage' | 'gdacs' | 'eonet' | 'iss'
  /** ArcGIS REST Feature Service endpoint, or a public GeoJSON feed URL. */
  url: string
  defaultVisible: boolean
}

/** Union of layer ids, derived from the descriptor list. */
export type LayerId = (typeof LAYER_DESCRIPTORS)[number]['id']

/** Live position of the station; the same URL is polled by startIssTracking. */
const ISS_FEED_URL = 'https://api.wheretheiss.at/v1/satellites/25544'

/**
 * The quakes layer streams the live USGS feed (past 7 days, worldwide) and
 * auto-refreshes. EONET streams NASA's open natural events, GDACS adds the
 * global tropical-cyclone picture (including the Western Pacific typhoons NHC
 * does not cover), and NHC contributes live forecast cones for the Atlantic and
 * East Pacific. The ISS marker is polled live.
 */
export const LAYER_DESCRIPTORS: readonly LayerDescriptor[] = [
  {
    id: 'earthquakes',
    title: 'Earthquakes — live USGS feed',
    shortTitle: 'quakes',
    description: 'Past 7 days worldwide · refreshes automatically.',
    kind: 'geojson',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
    defaultVisible: true,
  },
  {
    id: 'nhc',
    title: 'NHC forecast cones — live',
    shortTitle: 'NHC',
    description: 'Active Atlantic and East Pacific tracks and cones.',
    kind: 'mapimage',
    url: 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer',
    defaultVisible: false,
  },
  {
    id: 'storms',
    title: 'Tropical cyclones — GDACS (live)',
    shortTitle: 'storms',
    description: 'Global storms, sized by GDACS alert level.',
    kind: 'gdacs',
    url: GDACS_STORMS_URL,
    defaultVisible: true,
  },
  {
    id: 'eonet',
    title: 'Natural events — NASA EONET',
    shortTitle: 'events',
    description: 'Open wildfires, storms, and sea ice from the last 30 days.',
    kind: 'eonet',
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?days=30&status=open',
    defaultVisible: true,
  },
  {
    id: 'iss',
    title: 'ISS — live position',
    shortTitle: 'ISS',
    description: 'The space station, polled every 5 seconds.',
    kind: 'iss',
    url: ISS_FEED_URL,
    defaultVisible: true,
  },
] as const

/** Attribute shape of the USGS quake feed (subset we render). */
export interface QuakeAttributes {
  mag: number | null
  place: string | null
  /** Epoch milliseconds (UTC). */
  time: number | null
  depth: number | null
  url: string | null
  tsunami: number | null
}

/** Attribute shape of a GDACS storm after flattening (see lib/gdacs.ts). */
export type StormAttributes = StormProperties

/** Attribute shape of an EONET event after flattening (see lib/eonet.ts).
 * Scalars only — GeoJSONLayer drops object/array properties. */
export interface EonetEventAttributes {
  title: string | null
  /** API record URL; ends in /geojson — see eonetEventPageUrl. */
  link: string | null
  /** Epoch milliseconds of the event's latest geometry. */
  dateMs: number | null
  magnitudeValue: number | null
  magnitudeUnit: string | null
  /** Category title, e.g. "Wildfires" — the renderer's style field. */
  category: string | null
  /** Category id, e.g. "severeStorms" — what the popup uses to tell storms apart. */
  categoryId: string | null
  sourceName: string | null
  sourceUrl: string | null
}

/** Attribute shape of an ISS poll from wheretheiss.at (subset we render). */
export interface IssAttributes {
  name: string
  /** Kilometers above the surface. */
  altitude: number
  /** Kilometers per hour. */
  velocity: number
  /** Epoch milliseconds of the last successful poll. */
  updated: number
  /** 'daylight' | 'eclipsed' | 'visible' — sun state at the ISS. */
  visibility: string
}

const ISS_POLL_MS = 5000

interface IssFeed {
  latitude: number
  longitude: number
  altitude: number
  velocity: number
  visibility: string
  /** Unix seconds. */
  timestamp: number
}

/** Builds the HTML shown in a live quake popup. Pure so it can be unit-tested. */
export function buildQuakePopupHtml(a: QuakeAttributes): string {
  const depth = formatNullable(a.depth === null ? null : `${a.depth} km`)
  const tsunami = a.tsunami && a.tsunami > 0 ? '<div><dt>Tsunami flag</dt><dd>yes</dd></div>' : ''
  const link = a.url
    ? `<div><dt>Details</dt><dd><a href="${a.url}" target="_blank" rel="noopener noreferrer">USGS event page</a></dd></div>`
    : ''
  return [
    `<dl class="popup-facts">`,
    `<div><dt>Time (UTC)</dt><dd>${formatNullable(formatEpoch(a.time))}</dd></div>`,
    `<div><dt>Magnitude</dt><dd>${formatNullable(a.mag)}</dd></div>`,
    `<div><dt>Depth</dt><dd>${depth}</dd></div>`,
    tsunami,
    link,
    `</dl>`,
  ].join('')
}

/** Builds the HTML shown in a storm popup. Pure so it can be unit-tested. */
export function buildStormPopupHtml(a: StormProperties): string {
  const category = saffirSimpson(a.windKmh, 'km/h')
  const wind = a.windKmh === null ? null : `${Math.round(a.windKmh)} km/h`
  const updated = a.dateMs === null ? null : formatEpoch(a.dateMs)
  const report = a.reportUrl
    ? `<div><dt>Details</dt><dd><a href="${a.reportUrl}" target="_blank" rel="noopener noreferrer">GDACS report</a></dd></div>`
    : ''
  return [
    `<dl class="popup-facts">`,
    `<div><dt>Storm category</dt><dd>${formatNullable(category)}</dd></div>`,
    `<div><dt>Max wind</dt><dd>${formatNullable(wind)}</dd></div>`,
    `<div><dt>Alert level</dt><dd>${formatNullable(a.alertLevel)}</dd></div>`,
    `<div><dt>Updated (UTC)</dt><dd>${formatNullable(updated)}</dd></div>`,
    ...(a.countries ? [`<div><dt>Affected</dt><dd>${a.countries}</dd></div>`] : []),
    report,
    `</dl>`,
  ].join('')
}

/** v3 record links end in /geojson; strip the suffix to reach the event page. */
export function eonetEventPageUrl(link: string | null): string | null {
  return link ? link.replace(/\/geojson$/, '') : null
}

/** Builds the HTML shown in an EONET event popup. Pure so it can be unit-tested. */
export function buildEonetEventPopupHtml(a: EonetEventAttributes): string {
  const date = formatNullable(a.dateMs === null ? null : formatEpoch(a.dateMs))
  // Storms report wind, not a magnitude: the row is labelled for what it is and
  // the category is derived, because EONET only knows the hazard family.
  const isStorm = a.categoryId === 'severeStorms' || a.category === 'Severe Storms'
  const wind =
    a.magnitudeValue === null || a.magnitudeValue === undefined
      ? null
      : `${a.magnitudeValue} ${a.magnitudeUnit ?? ''}`.trim()
  const stormCategory = isStorm ? saffirSimpson(a.magnitudeValue, a.magnitudeUnit) : null
  const categoryLabel = isStorm ? 'Storm category' : 'Category'
  const categoryValue = isStorm ? stormCategory : a.category
  const windLabel = isStorm ? 'Max wind' : 'Magnitude'
  const pageUrl = eonetEventPageUrl(a.link)
  return [
    `<dl class="popup-facts">`,
    `<div><dt>${categoryLabel}</dt><dd>${formatNullable(categoryValue)}</dd></div>`,
    `<div><dt>Updated (UTC)</dt><dd>${date}</dd></div>`,
    ...(wind ? [`<div><dt>${windLabel}</dt><dd>${formatNullable(wind)}</dd></div>`] : []),
    ...(pageUrl
      ? [
          `<div><dt>Details</dt><dd><a href="${pageUrl}" target="_blank" rel="noopener noreferrer">EONET event page</a></dd></div>`,
        ]
      : []),
    ...(a.sourceUrl
      ? [
          `<div><dt>Source</dt><dd><a href="${a.sourceUrl}" target="_blank" rel="noopener noreferrer">${formatNullable(a.sourceName)}</a></dd></div>`,
        ]
      : []),
    `</dl>`,
  ].join('')
}

/** Builds the HTML shown in the ISS marker's popup. Pure so it can be unit-tested. */
export function buildIssPopupHtml(a: IssAttributes): string {
  return [
    `<dl class="popup-facts">`,
    `<div><dt>Altitude</dt><dd>${Math.round(a.altitude)} km</dd></div>`,
    `<div><dt>Velocity</dt><dd>${Math.round(a.velocity)} km/h</dd></div>`,
    `<div><dt>Position updated (UTC)</dt><dd>${formatNullable(formatEpoch(a.updated))}</dd></div>`,
    `<div><dt>Sunlight</dt><dd>${a.visibility === 'eclipsed' ? 'no (eclipsed)' : 'yes'}</dd></div>`,
    `</dl>`,
  ].join('')
}

const quakePopupTemplate = new PopupTemplate({
  title: 'M{mag} · {place}',
  outFields: ['mag', 'place', 'time', 'depth', 'url', 'tsunami'],
  content: ({ graphic }) => buildQuakePopupHtml(graphic.attributes as QuakeAttributes),
})

const stormPopupTemplate = new PopupTemplate({
  title: '{name}',
  outFields: ['name', 'alertLevel', 'windKmh', 'countries', 'dateMs', 'reportUrl'],
  content: ({ graphic }) => buildStormPopupHtml(graphic.attributes as StormProperties),
})

const eonetPopupTemplate = new PopupTemplate({
  title: '{title}',
  content: ({ graphic }) => buildEonetEventPopupHtml(graphic.attributes as EonetEventAttributes),
})

const issPopupTemplate = new PopupTemplate({
  title: '{name}',
  content: ({ graphic }) => buildIssPopupHtml(graphic.attributes as IssAttributes),
})

/** Magnitude color ramp, mirroring the bins of the retired sample service. */
function quakeRenderer(): ClassBreaksRenderer {
  const symbol = (color: string): SimpleMarkerSymbol =>
    new SimpleMarkerSymbol({ color, size: 10, outline: { color: '#0b1220', width: 0.5 } })
  return new ClassBreaksRenderer({
    field: 'mag',
    defaultSymbol: symbol('#8b98a9'),
    classBreakInfos: [
      { minValue: 0, maxValue: 3, symbol: symbol('#f2d43d') },
      { minValue: 3, maxValue: 4.5, symbol: symbol('#f8a13c') },
      { minValue: 4.5, maxValue: 6, symbol: symbol('#e5544b') },
      { minValue: 6, maxValue: 12, symbol: symbol('#a50f15') },
    ],
  })
}

/** A single-colour glyph marker: inline SVG path, sized for legibility. */
function iconSymbol(path: string, color: string, size = ICON_SIZE): SimpleMarkerSymbol {
  return new SimpleMarkerSymbol({
    style: 'path',
    path,
    size,
    color,
    outline: { color: ICON_OUTLINE_COLOR, width: 1 },
  })
}

/** Scalar fields produced by flattenEonetEvents. Declared so the layer types
 * them itself instead of inferring (and dropping) from the payload. */
const EONET_FIELDS = [
  { name: 'eventId', type: 'string' },
  { name: 'title', type: 'string' },
  { name: 'link', type: 'string' },
  { name: 'dateMs', type: 'double' },
  { name: 'magnitudeValue', type: 'double' },
  { name: 'magnitudeUnit', type: 'string' },
  { name: 'category', type: 'string' },
  { name: 'categoryId', type: 'string' },
  { name: 'sourceName', type: 'string' },
  { name: 'sourceUrl', type: 'string' },
] as const

/**
 * Builds the EONET layer from an already-flattened collection.
 *
 * The data has to be present when the layer is CONSTRUCTED: the SDK loads a
 * layer once, and neither a changed `url` nor a post-load `source` assignment
 * makes it reload (verified — the layer keeps the empty source it started
 * with). Hence this factory rather than a loader that updates a placeholder.
 */
export function createEonetLayer(
  descriptor: LayerDescriptor,
  collection: EonetFeatureCollection,
): GeoJSONLayer {
  return new GeoJSONLayer({
    id: descriptor.id,
    title: descriptor.title,
    url: toEonetDataUrl(collection),
    visible: descriptor.defaultVisible,
    // Track geometries were dropped while flattening; pin the type explicitly.
    geometryType: 'point',
    fields: EONET_FIELDS.map((field) => ({ ...field })),
    renderer: eonetRenderer(),
    popupTemplate: eonetPopupTemplate,
  })
}

/** Fetches and flattens the EONET feed. Returns null on any failure so the
 * caller can simply leave the layer out. */
export async function loadEonetEvents(): Promise<EonetFeatureCollection | null> {
  try {
    const res = await fetch(EONET_FEED_URL)
    if (!res.ok) return null
    return flattenEonetEvents(await res.json())
  } catch {
    return null
  }
}

/** Scalar fields produced by flattenGdacsStorms. Declared so the layer types
 * them itself instead of inferring (and dropping) from the payload. */
const STORM_FIELDS = [
  { name: 'eventId', type: 'double' },
  { name: 'name', type: 'string' },
  { name: 'alertLevel', type: 'string' },
  { name: 'windKmh', type: 'double' },
  { name: 'severityText', type: 'string' },
  { name: 'countries', type: 'string' },
  { name: 'dateMs', type: 'double' },
  { name: 'reportUrl', type: 'string' },
  { name: 'trackUrl', type: 'string' },
] as const

/** GDACS alert level drives the symbol: hue and size carry it together, so the
 * map still reads without colour. */
function stormRenderer(): UniqueValueRenderer {
  return new UniqueValueRenderer({
    field: 'alertLevel',
    uniqueValueInfos: [
      { value: 'Red', symbol: iconSymbol(ICON_PATHS.storm, '#e5544b', 22) },
      { value: 'Orange', symbol: iconSymbol(ICON_PATHS.storm, '#f8a13c', 18) },
      { value: 'Green', symbol: iconSymbol(ICON_PATHS.storm, '#7f8cff', 14) },
    ],
    defaultSymbol: iconSymbol(ICON_PATHS.storm, '#8b98a9', 12),
  })
}

/** Builds the GDACS storm layer from an already-flattened collection. Same
 * construction-time rule as EONET: the data has to exist when the layer is built. */
export function createStormsLayer(
  descriptor: LayerDescriptor,
  collection: StormFeatureCollection,
): GeoJSONLayer {
  return new GeoJSONLayer({
    id: descriptor.id,
    title: descriptor.title,
    url: toStormDataUrl(collection),
    visible: descriptor.defaultVisible,
    geometryType: 'point',
    fields: STORM_FIELDS.map((field) => ({ ...field })),
    renderer: stormRenderer(),
    popupTemplate: stormPopupTemplate,
  })
}

/** Id of the transient layer that draws the selected storm's wind radii. */
export const STORM_TRACK_LAYER_ID = 'storm-track'

/** The selected storm's forecast/wind-radii polygons, drawn under the storm
 * points and cleared when the popup closes. Built from geometry that has already
 * been fetched: a failing GeoJSONLayer logs an SDK error, and a slow feed should
 * not produce console noise. */
export function createStormTrackLayer(track: StormTrack): GeoJSONLayer {
  return new GeoJSONLayer({
    id: STORM_TRACK_LAYER_ID,
    title: 'Storm track and wind radii',
    url: toTrackDataUrl(track),
    visible: true,
    popupEnabled: false,
    renderer: new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: [127, 140, 255, 0.12],
        outline: { color: [127, 140, 255, 0.55], width: 1, style: 'dash' },
      }),
    }),
  })
}

/** Category color coding for the EONET feed — value comes from the flattened
 * `category` field. Each category also gets its own glyph: shape is the
 * redundant channel, so the map stays readable without relying on hue alone. */
function eonetRenderer(): UniqueValueRenderer {
  return new UniqueValueRenderer({
    field: 'category',
    uniqueValueInfos: [
      { value: 'Wildfires', symbol: iconSymbol(ICON_PATHS.wildfire, '#e5544b') },
      { value: 'Severe Storms', symbol: iconSymbol(ICON_PATHS.storm, '#7f8cff') },
      { value: 'Sea and Lake Ice', symbol: iconSymbol(ICON_PATHS.ice, '#6fd0ff') },
      { value: 'Volcanoes', symbol: iconSymbol(ICON_PATHS.volcano, '#f2d43d') },
    ],
    // Unknown/unmapped categories fall back to a neutral dot rather than a
    // misleading hazard glyph.
    defaultSymbol: new SimpleMarkerSymbol({
      color: '#8b98a9',
      size: 10,
      outline: { color: ICON_OUTLINE_COLOR, width: 0.5 },
    }),
  })
}

/** The ISS marker appears on the first successful poll (the layer starts
 * empty), then its geometry and attributes are mutated in place. */
function buildIssLayer(descriptor: LayerDescriptor): GraphicsLayer {
  // PopupTemplate rides on the graphic (GraphicsLayer takes none) — set below
  // when the first poll injects it.
  return new GraphicsLayer({
    id: descriptor.id,
    title: descriptor.title,
    visible: descriptor.defaultVisible,
  })
}

/** Polls the wheretheiss.at feed and drives the single ISS graphic. Stops
 * itself once the layer is destroyed with the rest of the view; poll errors
 * (network hiccups) are expected and simply retry on the next tick.
 * `onFix` fires once the first position lands, so the UI can enable a
 * locate affordance only when there is somewhere to fly to. */
export function startIssTracking(layer: GraphicsLayer, feedUrl: string, onFix?: () => void): void {
  let graphic: Graphic | null = null
  let notified = false
  const update = async (): Promise<void> => {
    try {
      const res = await fetch(feedUrl)
      if (!res.ok) return
      const feed = (await res.json()) as IssFeed
      if (layer.destroyed) return
      const geometry = new Point({ longitude: feed.longitude, latitude: feed.latitude })
      const attributes: IssAttributes = {
        name: 'ISS (ZARYA)',
        altitude: feed.altitude,
        velocity: feed.velocity,
        updated: feed.timestamp * 1000,
        visibility: feed.visibility,
      }
      if (graphic) {
        // oxlint-disable-next-line react/immutability
        graphic.geometry = geometry
        // oxlint-disable-next-line react/immutability
        graphic.attributes = attributes
      } else {
        graphic = new Graphic({
          geometry,
          attributes,
          symbol: iconSymbol(ICON_PATHS.satellite, '#6fd0ff', 20),
          popupTemplate: issPopupTemplate,
        })
        layer.add(graphic)
      }
      if (!notified) {
        notified = true
        onFix?.()
      }
    } catch {
      // Network hiccup — retried on the next tick.
    }
  }
  void update()
  const timer = setInterval(() => {
    if (layer.destroyed) {
      clearInterval(timer)
      return
    }
    void update()
  }, ISS_POLL_MS)
}

/** Typed field declarations so the renderer, clustering, and timeInfo are stable. */
const QUAKE_FIELDS = [
  { name: 'mag', type: 'double' },
  { name: 'place', type: 'string' },
  { name: 'time', type: 'double' },
  { name: 'depth', type: 'double' },
  { name: 'tsunami', type: 'integer' },
  { name: 'sig', type: 'integer' },
  { name: 'url', type: 'string' },
] as const

/** Creates the live layer instances described by LAYER_DESCRIPTORS. EONET and
 * GDACS are absent here: their layers are built from flattened data once the
 * feed arrives, because a layer never reloads after it has loaded. */
export function buildFeatureLayers(): AppLayer[] {
  const layers: AppLayer[] = []
  for (const d of LAYER_DESCRIPTORS) {
    if (d.kind === 'eonet' || d.kind === 'gdacs') continue
    if (d.kind === 'iss') {
      layers.push(buildIssLayer(d))
      continue
    }
    if (d.kind === 'geojson') {
      layers.push(
        new GeoJSONLayer({
          id: d.id,
          title: d.title,
          url: d.url,
          visible: d.defaultVisible,
          fields: QUAKE_FIELDS.map((f) => ({ ...f })),
          renderer: quakeRenderer(),
          popupTemplate: quakePopupTemplate,
          featureReduction: { type: 'cluster', clusterRadius: 60 },
          // Epoch-millis number field driving the TimeSlider.
          timeInfo: new TimeInfo({ startField: 'time' }),
          refreshInterval: 2,
        }),
      )
      continue
    }
    if (d.kind === 'mapimage') {
      layers.push(
        new MapImageLayer({
          id: d.id,
          title: d.title,
          url: d.url,
          visible: d.defaultVisible,
          // Server-side symbology; a little transparency keeps the basemap legible.
          opacity: 0.85,
        }),
      )
    }
  }
  return layers
}
