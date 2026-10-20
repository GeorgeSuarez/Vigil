import PopupTemplate from '@arcgis/core/PopupTemplate'
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import TimeInfo from '@arcgis/core/layers/support/TimeInfo'
import { formatEpoch, formatNullable } from './format'

export type { FeatureLayer }
export type { GeoJSONLayer }

/** Both concrete layer types used by the app — they share the surface we rely on. */
export type AppLayer = FeatureLayer | GeoJSONLayer

/** Static, testable description of a dataset shown in the layer panel. */
export interface LayerDescriptor {
  id: string
  title: string
  /** Compact label for tight UI contexts (e.g. the status bar). */
  shortTitle: string
  description: string
  /** Where the layer's data comes from — decides which layer class gets built. */
  kind: 'geojson' | 'service'
  /** ArcGIS REST Feature Service endpoint, or a public GeoJSON feed URL. */
  url: string
  defaultVisible: boolean
}

/** Union of layer ids, derived from the descriptor list. */
export type LayerId = (typeof LAYER_DESCRIPTORS)[number]['id']

/**
 * The quakes layer streams the live USGS feed (past 7 days, worldwide) and
 * auto-refreshes. The hurricanes layer is a static Esri sample service.
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

/** Creates the live layer instances described by LAYER_DESCRIPTORS. */
export function buildFeatureLayers(): AppLayer[] {
  return LAYER_DESCRIPTORS.map((d) => {
    if (d.kind === 'geojson') {
      return new GeoJSONLayer({
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
      })
    }
    return new FeatureLayer({
      id: d.id,
      title: d.title,
      url: d.url,
      visible: d.defaultVisible,
      popupTemplate: hurricanePopupTemplate,
    })
  })
}
