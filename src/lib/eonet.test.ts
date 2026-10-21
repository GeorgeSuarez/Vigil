import { describe, expect, it } from 'vitest'
import { flattenEonetEvents, toEonetDataUrl } from './eonet'

/** A miniature feed with the property shapes that break GeoJSONLayer's field
 * inference: object-valued `categories`/`sources` arrays. */
const FEED = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-114.2, 44.1] },
      properties: {
        id: 'EONET_1',
        title: 'Wildfire - Idaho',
        link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1/geojson',
        date: '2026-10-18T18:00:00Z',
        magnitudeValue: 500,
        magnitudeUnit: 'acres',
        categories: [{ id: 'wildfires', title: 'Wildfires' }],
        sources: [{ id: 'NIFC', url: 'https://example.com/fire/1' }],
      },
    },
    {
      // Storm-track line: not a point, must be dropped.
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [10, 10],
          [11, 11],
        ],
      },
      properties: { id: 'EONET_2', title: 'Track', categories: [{ title: 'Severe Storms' }] },
    },
    {
      // Broken coordinates: skipped rather than producing an invalid graphic.
      type: 'Feature',
      geometry: { type: 'Point', coordinates: ['x', null] },
      properties: { id: 'EONET_3', title: 'Broken' },
    },
  ],
}

describe('flattenEonetEvents', () => {
  it('turns object-valued properties into styleable scalars', () => {
    const { features } = flattenEonetEvents(FEED)
    expect(features).toHaveLength(1)
    const props = features[0].properties
    expect(props.category).toBe('Wildfires')
    expect(props.categoryId).toBe('wildfires')
    expect(props.sourceName).toBe('NIFC')
    expect(props.sourceUrl).toBe('https://example.com/fire/1')
    expect(props.dateMs).toBe(Date.UTC(2026, 9, 18, 18, 0))
    expect(props.magnitudeValue).toBe(500)
  })

  it('drops non-point geometries and unusable coordinates', () => {
    const { features } = flattenEonetEvents(FEED)
    expect(features.map((f) => f.properties.eventId)).toEqual(['EONET_1'])
    for (const feature of features) expect(feature.geometry.type).toBe('Point')
  })

  it('tolerates malformed input', () => {
    expect(flattenEonetEvents(null).features).toEqual([])
    expect(flattenEonetEvents({}).features).toEqual([])
    expect(flattenEonetEvents({ features: 'nope' }).features).toEqual([])
  })

  it('leaves missing optional values null rather than undefined', () => {
    const { features } = flattenEonetEvents({
      features: [{ geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }],
    })
    const props = features[0].properties
    for (const value of Object.values(props)) expect(value).toBeNull()
  })
})

describe('toEonetDataUrl', () => {
  it('serialises features and omits null properties', () => {
    const url = toEonetDataUrl(flattenEonetEvents(FEED))
    expect(url.startsWith('data:application/geo+json,')).toBe(true)
    const decoded = JSON.parse(decodeURIComponent(url.split(',')[1])) as {
      features: { properties: Record<string, unknown> }[]
    }
    expect(decoded.features).toHaveLength(1)
    expect(decoded.features[0].properties.category).toBe('Wildfires')
    // Nulls are dropped to keep the data URL small.
    const noSource = toEonetDataUrl(
      flattenEonetEvents({
        features: [{ geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }],
      }),
    )
    const bare = JSON.parse(decodeURIComponent(noSource.split(',')[1]))
    expect(bare.features[0].properties).toEqual({})
  })
})
