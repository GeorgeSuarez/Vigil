import PopupTemplate from '@arcgis/core/PopupTemplate'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import { formatNullable, formatNumber } from './format'

export type { FeatureLayer }

/** Static, testable description of a dataset shown in the layer panel. */
export interface LayerDescriptor {
  id: string
  title: string
  description: string
  /** Public ArcGIS REST Feature Service endpoint (keyless access). */
  url: string
  defaultVisible: boolean
}

/** Union of layer ids, derived from the descriptor list. */
export type LayerId = (typeof LAYER_DESCRIPTORS)[number]['id']

/**
 * Keyless demo layers hosted on Esri's public sample server.
 * Swap in Living Atlas or ArcGIS Online hosted layers as the app grows.
 */
export const LAYER_DESCRIPTORS: readonly LayerDescriptor[] = [
  {
    id: 'earthquakes',
    title: 'Earthquakes, 1970–2018',
    description: 'M5+ global events, clustered by proximity.',
    url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Earthquakes_Since1970/MapServer/0',
    defaultVisible: true,
  },
  {
    id: 'hurricanes',
    title: 'Atlantic Hurricanes, 2000',
    description: 'Storm fixes with pressure and wind speed.',
    url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Hurricanes/MapServer/0',
    defaultVisible: false,
  },
] as const

/** Attribute shape of the Earthquakes sample layer (subset we render). */
export interface QuakeAttributes {
  name: string | null
  magnitude: number | null
  year_: number | null
  mo: number | null
  dy: number | null
  num_deaths: number | null
  mill_damages: number | null
}

/** Attribute shape of the Hurricanes sample layer (subset we render). */
export interface HurricaneAttributes {
  EVENTID: number | null
  STAGE: string | null
  WINDSPEED: number | null
  PRESSURE: number | null
  Date_Time: number | null
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

function formatQuakeDate(a: QuakeAttributes): string {
  if (a.year_ === null || a.mo === null || a.dy === null) return '—'
  const month = MONTHS[(a.mo - 1) % 12] ?? '—'
  return `${month} ${a.dy}, ${a.year_}`
}

/** Builds the HTML shown in an earthquake popup. Pure so it can be unit-tested. */
export function buildQuakePopupHtml(a: QuakeAttributes): string {
  const deaths = formatNullable(
    a.num_deaths === null ? null : formatNumber(a.num_deaths),
  )
  const damages = formatNullable(
    a.mill_damages === null ? null : `$${formatNumber(a.mill_damages)}M`,
  )
  return [
    `<dl class="popup-facts">`,
    `<div><dt>Date</dt><dd>${formatNullable(formatQuakeDate(a))}</dd></div>`,
    `<div><dt>Magnitude</dt><dd>${formatNullable(a.magnitude)}</dd></div>`,
    `<div><dt>Reported deaths</dt><dd>${deaths}</dd></div>`,
    `<div><dt>Reported damages</dt><dd>${damages}</dd></div>`,
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
  title: 'M{magnitude} · {name}',
  outFields: [
    'name',
    'magnitude',
    'year_',
    'mo',
    'dy',
    'num_deaths',
    'mill_damages',
  ],
  content: ({ graphic }) => buildQuakePopupHtml(graphic.attributes as QuakeAttributes),
})

const hurricanePopupTemplate = new PopupTemplate({
  title: 'Hurricane event {EVENTID}',
  outFields: ['EVENTID', 'STAGE', 'WINDSPEED', 'PRESSURE'],
  content: ({ graphic }) =>
    buildHurricanePopupHtml(graphic.attributes as HurricaneAttributes),
})

/** Creates the live FeatureLayer instances described by LAYER_DESCRIPTORS. */
export function buildFeatureLayers(): FeatureLayer[] {
  return LAYER_DESCRIPTORS.map((d) => {
    return new FeatureLayer({
      id: d.id,
      title: d.title,
      url: d.url,
      visible: d.defaultVisible,
      popupTemplate: d.id === 'earthquakes' ? quakePopupTemplate : hurricanePopupTemplate,
      featureReduction:
        d.id === 'earthquakes'
          ? { type: 'cluster', clusterRadius: 60 }
          : undefined,
    })
  })
}
