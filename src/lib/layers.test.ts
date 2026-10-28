import { describe, expect, it } from 'vitest'
import type SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import type UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer'
import {
  buildEonetEventPopupHtml,
  buildFeatureLayers,
  buildStormPopupHtml,
  buildIssPopupHtml,
  buildQuakePopupHtml,
  createEonetLayer,
  eonetEventPageUrl,
  type EonetEventAttributes,
  type IssAttributes,
  LAYER_DESCRIPTORS,
  type GeoJSONLayer,
  type MapImageLayer,
  type QuakeAttributes,
} from './layers'

describe('LAYER_DESCRIPTORS', () => {
  it('has unique ids and https endpoints', () => {
    const ids = LAYER_DESCRIPTORS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const layer of LAYER_DESCRIPTORS) {
      expect(layer.url).toMatch(/^https:\/\//)
    }
  })
})

describe('buildFeatureLayers', () => {
  it('builds the live USGS feed with epoch timeInfo, and a server-rendered NHC layer', () => {
    const layers = buildFeatureLayers()
    const quakes = layers.find((l): l is GeoJSONLayer => l.type === 'geojson')
    const nhc = layers.find((l): l is MapImageLayer => l.type === 'map-image')
    expect(quakes?.id).toBe('earthquakes')
    expect(quakes?.timeInfo?.startField).toBe('time')
    // NHC's cones render server-side, so the layer carries no feature timeInfo.
    expect(nhc?.id).toBe('nhc')
    expect(nhc?.url).toContain('mapservices.weather.noaa.gov/tropical')
  })

  it('leaves the fetched feeds out of the startup layers, and includes the ISS marker', () => {
    const layers = buildFeatureLayers()
    // EONET and GDACS are created from flattened data once their feeds arrive —
    // a layer never reloads after load, so neither can be a placeholder.
    expect(layers.some((l) => l.id === 'eonet')).toBe(false)
    expect(layers.some((l) => l.id === 'storms')).toBe(false)
    const iss = layers.find((l) => l.type === 'graphics')
    expect(iss?.id).toBe('iss')
  })

  it('builds the EONET layer from flattened data, pinned to points', () => {
    const descriptor = LAYER_DESCRIPTORS.find((d) => d.kind === 'eonet')
    if (!descriptor) throw new Error('missing eonet descriptor')
    const layer = createEonetLayer(descriptor, {
      type: 'FeatureCollection',
      features: [],
    })
    expect(layer.type).toBe('geojson')
    expect(layer.geometryType).toBe('point')
    expect(layer.url?.startsWith('data:application/geo+json,')).toBe(true)
    expect(layer.fields.some((field) => field.name === 'category')).toBe(true)
    layer.destroy()
  })

  it('gives every EONET category its own glyph, not just a hue', () => {
    const descriptor = LAYER_DESCRIPTORS.find((d) => d.kind === 'eonet')
    if (!descriptor) throw new Error('missing eonet descriptor')
    const events = createEonetLayer(descriptor, { type: 'FeatureCollection', features: [] })
    const renderer = events.renderer as UniqueValueRenderer
    const infos = renderer.uniqueValueInfos as { value: string; symbol: SimpleMarkerSymbol }[]
    expect(infos.map((info) => info.value)).toEqual([
      'Wildfires',
      'Severe Storms',
      'Sea and Lake Ice',
      'Volcanoes',
    ])
    // Shape is the redundant (accessible) channel: each category must differ.
    const paths = infos.map((info) => info.symbol.path)
    for (const path of paths) expect(path.length).toBeGreaterThan(10)
    expect(new Set(paths).size).toBe(paths.length)
    for (const info of infos) expect(info.symbol.style).toBe('path')
    events.destroy()
  })
})

describe('eonetEventPageUrl', () => {
  it('strips the /geojson suffix to reach the human event page', () => {
    expect(eonetEventPageUrl('https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1/geojson')).toBe(
      'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1',
    )
    expect(eonetEventPageUrl(null)).toBeNull()
  })
})

describe('buildEonetEventPopupHtml', () => {
  const attrs: EonetEventAttributes = {
    title: 'Wildfire - Idaho, United States',
    link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_6001/geojson',
    dateMs: Date.UTC(2026, 9, 18, 18, 0),
    magnitudeValue: null,
    magnitudeUnit: null,
    category: 'Wildfires',
    categoryId: 'wildfires',
    sourceName: 'NIFS',
    sourceUrl: 'https://nifs.example.com/fire/6001',
  }

  it('renders category, source link, and the EONET event page', () => {
    const html = buildEonetEventPopupHtml(attrs)
    expect(html).toContain('Wildfires')
    expect(html).toContain('UTC')
    expect(html).toContain('nasa.gov/api/v3/events/EONET_6001"')
    expect(html).toContain('href="https://nifs.example.com/fire/6001"')
  })

  it('omits the magnitude row and links when absent', () => {
    const html = buildEonetEventPopupHtml({
      ...attrs,
      magnitudeValue: 35,
      magnitudeUnit: 'kts',
      link: null,
      sourceUrl: null,
    })
    expect(html).toContain('35 kts')
    expect(html).not.toContain('event page')
    // Magnitude adds a row; dropping both links removes two, so category +
    // updated + magnitude remain.
    expect((html.match(/<div>/g) ?? []).length).toBe(3)
  })

  it('labels storm wind and derives the category for severe storms', () => {
    const html = buildEonetEventPopupHtml({
      ...attrs,
      category: 'Severe Storms',
      categoryId: 'severeStorms',
      magnitudeValue: 95,
      magnitudeUnit: 'kts',
    })
    expect(html).toContain('Storm category')
    expect(html).toContain('Category 2')
    expect(html).toContain('Max wind')
    expect(html).toContain('95 kts')
    expect(html).not.toContain('Magnitude')
  })
})

describe('buildIssPopupHtml', () => {
  it('renders altitude, velocity, and sun state', () => {
    const attrs: IssAttributes = {
      name: 'ISS (ZARYA)',
      altitude: 419.077,
      velocity: 27582.597,
      updated: 1_792_533_768_000,
      visibility: 'eclipsed',
    }
    const html = buildIssPopupHtml(attrs)
    expect(html).toContain('419 km')
    expect(html).toContain('27583 km/h')
    expect(html).toContain('UTC')
    expect(html).toContain('no (eclipsed)')
  })
})

describe('buildQuakePopupHtml', () => {
  const attrs: QuakeAttributes = {
    mag: 4.8,
    place: '12 km NE of Barstow, CA',
    time: 1_792_460_072_709,
    depth: 8.2,
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/abc123',
    tsunami: 0,
  }

  it('includes magnitude, place, UTC time, depth, and the USGS link', () => {
    const html = buildQuakePopupHtml(attrs)
    expect(html).toContain('4.8')
    expect(html).toContain('UTC')
    expect(html).toContain('8.2 km')
    expect(html).toContain('href="https://earthquake.usgs.gov/earthquakes/eventpage/abc123"')
  })

  it('renders em dashes and omits the link when values are missing', () => {
    const html = buildQuakePopupHtml({ ...attrs, place: null, depth: null, url: null })
    expect(html).toContain('—')
    expect(html).not.toContain('href=')
  })

  it('flags tsunami events', () => {
    const html = buildQuakePopupHtml({ ...attrs, tsunami: 1 })
    expect(html).toContain('yes')
  })
})

describe('buildStormPopupHtml', () => {
  const attrs = {
    eventId: 1001338,
    name: 'CHAMPI-26',
    alertLevel: 'Red',
    windKmh: 296.2944,
    severityText: 'Hurricane/Typhoon > 74 mph (maximum wind speed of 296 km/h)',
    countries: 'Philippines, Guam, Japan',
    dateMs: Date.UTC(2026, 9, 23, 0, 30),
    reportUrl: 'https://www.gdacs.org/report.aspx?eventid=1001338',
    trackUrl:
      'https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=1001338&episodeid=34',
  }

  it('derives the Saffir–Simpson category from the km/h wind speed', () => {
    const html = buildStormPopupHtml(attrs)
    expect(html).toContain('Category 5')
    expect(html).toContain('296 km/h')
    expect(html).toContain('Red')
    expect(html).toContain('Philippines')
    expect(html).toContain('gdacs.org/report.aspx')
  })

  it('dashes out missing values instead of guessing', () => {
    const html = buildStormPopupHtml({
      ...attrs,
      alertLevel: null,
      windKmh: null,
      countries: null,
      reportUrl: null,
    })
    expect(html).toContain('—')
    expect(html).not.toContain('GDACS report')
  })
})
