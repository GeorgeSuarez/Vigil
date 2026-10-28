import { describe, expect, it } from 'vitest'
import { flattenGdacsStorms, GDACS_STORMS_URL, toStormDataUrl } from './gdacs'

/** One feature in the shape GDACS actually returns (nested objects included). */
const raw = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [124.3, 21.9] },
      properties: {
        eventtype: 'TC',
        eventid: 1001338,
        episodeid: 34,
        eventname: 'CHAMPI-26',
        name: 'Tropical Cyclone CHAMPI-26',
        alertlevel: 'Red',
        datemodified: '2026-10-23T00:37:52',
        country: 'Philippines, Guam, Japan',
        severitydata: {
          severity: 296.2944,
          severitytext: 'Hurricane/Typhoon > 74 mph (maximum wind speed of 296 km/h)',
          severityunit: 'km/h',
        },
        url: {
          report: 'https://www.gdacs.org/report.aspx?eventid=1001338',
          geometry:
            'https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=1001338&episodeid=34',
        },
      },
    },
    // Non-point geometries are dropped, as are features with no coordinates.
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[0, 0]]] },
      properties: { eventname: 'TRACK-ONLY' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [] },
      properties: { eventname: 'NO-COORDS' },
    },
  ],
}

describe('GDACS_STORMS_URL', () => {
  it('requests tropical cyclones over https', () => {
    expect(GDACS_STORMS_URL.startsWith('https://')).toBe(true)
    expect(GDACS_STORMS_URL).toContain('eventtype=TC')
  })
})

describe('flattenGdacsStorms', () => {
  it('lifts the nested severity and url objects into scalars', () => {
    const collection = flattenGdacsStorms(raw)
    expect(collection.features).toHaveLength(1)
    const props = collection.features[0].properties
    expect(props.name).toBe('CHAMPI-26')
    expect(props.alertLevel).toBe('Red')
    expect(props.windKmh).toBeCloseTo(296.2944, 3)
    expect(props.countries).toContain('Philippines')
    expect(props.reportUrl).toContain('report.aspx')
    expect(props.trackUrl).toContain('getgeometry')
    expect(props.dateMs).toBeGreaterThan(0)
  })

  it('keeps only point features with usable coordinates', () => {
    const names = flattenGdacsStorms(raw).features.map((f) => f.properties.name)
    expect(names).toEqual(['CHAMPI-26'])
  })

  it('survives a payload that is not a FeatureCollection', () => {
    expect(flattenGdacsStorms(null).features).toHaveLength(0)
    expect(flattenGdacsStorms({ features: 'nope' }).features).toHaveLength(0)
  })
})

describe('toStormDataUrl', () => {
  it('serialises as a geo+json data URL and drops null properties', () => {
    const url = toStormDataUrl(
      flattenGdacsStorms({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [10, 20] },
            properties: { eventname: 'SPARSE-26' },
          },
        ],
      }),
    )
    expect(url.startsWith('data:application/geo+json,')).toBe(true)
    const payload = JSON.parse(decodeURIComponent(url.split(',')[1])) as {
      features: { properties: Record<string, unknown> }[]
    }
    expect(payload.features[0].properties).toStrictEqual({ name: 'SPARSE-26' })
  })
})
