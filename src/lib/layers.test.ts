import { describe, expect, it } from 'vitest'
import {
  buildEonetEventPopupHtml,
  buildFeatureLayers,
  buildHurricanePopupHtml,
  buildIssPopupHtml,
  buildQuakePopupHtml,
  eonetEventPageUrl,
  type EonetEventAttributes,
  type IssAttributes,
  LAYER_DESCRIPTORS,
  type FeatureLayer,
  type GeoJSONLayer,
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
  it('builds the live USGS feed layer with epoch timeInfo, and a service layer without', () => {
    const layers = buildFeatureLayers()
    const quakes = layers.find(
      (l): l is FeatureLayer | GeoJSONLayer => l.type !== 'graphics' && l.id === 'earthquakes',
    )
    const storms = layers.find(
      (l): l is FeatureLayer | GeoJSONLayer => l.type !== 'graphics' && l.id === 'hurricanes',
    )
    expect(quakes?.type).toBe('geojson')
    expect(quakes?.timeInfo?.startField).toBe('time')
    expect(storms?.type).toBe('feature')
    // Service layers keep timeInfo null until the service publishes one at load;
    // the Hurricanes sample service does not.
    expect(storms?.timeInfo).toBeNull()
  })

  it('builds the EONET layer pinned to points and an empty ISS graphics layer', () => {
    const layers = buildFeatureLayers()
    const events = layers.find((l): l is GeoJSONLayer => l.type === 'geojson' && l.id === 'eonet')
    // The feed mixes storm-track LineStrings with points; the layer pins to
    // points so track geometries are ignored.
    expect(events?.geometryType).toBe('point')
    const iss = layers.find((l) => l.type === 'graphics')
    expect(iss?.id).toBe('iss')
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
    description: null,
    link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_6001/geojson',
    date: '2026-10-18T18:00:00Z',
    magnitudeValue: null,
    magnitudeUnit: null,
    categories: [{ id: 'wildfires', title: 'Wildfires' }],
    sources: [{ id: 'NIFS', url: 'https://nifs.example.com/fire/6001' }],
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
      sources: null,
    })
    expect(html).toContain('35 kts')
    expect(html).not.toContain('event page')
    // Magnitude adds a row; dropping both links removes two, so category +
    // updated + magnitude remain.
    expect((html.match(/<div>/g) ?? []).length).toBe(3)
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

describe('buildHurricanePopupHtml', () => {
  it('formats wind speed and pressure with units', () => {
    const html = buildHurricanePopupHtml({
      EVENTID: 42,
      STAGE: 'Hurricane',
      WINDSPEED: 115,
      PRESSURE: 950,
      Date_Time: null,
    })
    expect(html).toContain('Hurricane')
    expect(html).toContain('115 kt')
    expect(html).toContain('950 mb')
  })
})
