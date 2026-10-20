import { describe, expect, it } from 'vitest'
import {
  buildFeatureLayers,
  buildHurricanePopupHtml,
  buildQuakePopupHtml,
  LAYER_DESCRIPTORS,
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
    const quakes = layers.find((l) => l.id === 'earthquakes')
    const storms = layers.find((l) => l.id === 'hurricanes')
    expect(quakes?.type).toBe('geojson')
    expect(quakes?.timeInfo?.startField).toBe('time')
    expect(storms?.type).toBe('feature')
    // Service layers keep timeInfo null until the service publishes one at load;
    // the Hurricanes sample service does not.
    expect(storms?.timeInfo).toBeNull()
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
