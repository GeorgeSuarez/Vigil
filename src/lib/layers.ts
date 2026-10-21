import PopupTemplate from '@arcgis/core/PopupTemplate'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer'
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import TimeInfo from '@arcgis/core/layers/support/TimeInfo'
import { formatEpoch, formatNullable } from './format'
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

/** Concrete layer types used by the app. Feature layers power popups,
 * renderers, and stats queries; the graphics layer hosts the ISS marker. */
export type AppLayer = FeatureLayer | GeoJSONLayer | GraphicsLayer

/** Static, testable description of a dataset shown in the layer panel. */
export interface LayerDescriptor {
  id: string
  title: string
  /** Compact label for tight UI contexts (e.g. the status bar). */
  shortTitle: string
  description: string
  /** Where the layer's data comes from — decides which factory recipe builds it. */
  kind: 'geojson' | 'service' | 'eonet' | 'iss'
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
 * auto-refreshes. EONET streams NASA's open natural events. The hurricanes
 * layer is a static Esri sample service. The ISS marker is polled live.
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
    id: 'hurricanes',
    title: 'Atlantic Hurricanes, 2000',
    shortTitle: 'storms',
    description: 'Storm fixes with pressure and wind speed.',
    kind: 'service',
    url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Hurricanes/MapServer/0',
    defaultVisible: false,
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

/** Attribute shape of the Hurricanes sample layer (subset we render). */
export interface HurricaneAttributes {
  EVENTID: number | null
  STAGE: string | null
  WINDSPEED: number | null
  PRESSURE: number | null
  Date_Time: number | null
}

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

/** Builds the HTML shown in a hurricane popup. Pure so it can be unit-tested. */
export function buildHurricanePopupHtml(a: HurricaneAttributes): string {
  return [
    `<dl class="popup-facts">`,
    `<div><dt>Stage</dt><dd>${formatNullable(a.STAGE)}</dd></div>`,
    `<div><dt>Wind speed</dt><dd>${formatNullable(
      a.WINDSPEED === null ? null : `${a.WINDSPEED} kt`,
    )}</dd></div>`,
    `<div><dt>Pressure</dt><dd>${formatNullable(
      a.PRESSURE === null ? null : `${a.PRESSURE} mb`,
    )}</dd></div>`,
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
  const magnitude =
    a.magnitudeValue === null || a.magnitudeValue === undefined
      ? null
      : `${a.magnitudeValue} ${a.magnitudeUnit ?? ''}`.trim()
  const pageUrl = eonetEventPageUrl(a.link)
  return [
    `<dl class="popup-facts">`,
    `<div><dt>Category</dt><dd>${formatNullable(a.category)}</dd></div>`,
    `<div><dt>Updated (UTC)</dt><dd>${date}</dd></div>`,
    ...(magnitude ? [`<div><dt>Magnitude</dt><dd>${formatNullable(magnitude)}</dd></div>`] : []),
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

const hurricanePopupTemplate = new PopupTemplate({
  title: 'Hurricane event {EVENTID}',
  outFields: ['EVENTID', 'STAGE', 'WINDSPEED', 'PRESSURE'],
  content: ({ graphic }) => buildHurricanePopupHtml(graphic.attributes as HurricaneAttributes),
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

/** Creates the live layer instances described by LAYER_DESCRIPTORS. EONET is
 * absent here: it is created from flattened data once the feed arrives. */
export function buildFeatureLayers(): AppLayer[] {
  const layers: AppLayer[] = []
  for (const d of LAYER_DESCRIPTORS) {
    if (d.kind === 'eonet') continue
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
    layers.push(
      new FeatureLayer({
        id: d.id,
        title: d.title,
        url: d.url,
        visible: d.defaultVisible,
        popupTemplate: hurricanePopupTemplate,
      }),
    )
  }
  return layers
}
