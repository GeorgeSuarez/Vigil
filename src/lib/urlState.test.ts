import { describe, expect, it } from 'vitest'
import { parseUrlState, serializeUrlState, type UrlState } from './urlState'

const KNOWN_BASEMAPS = ['osm', 'topo', 'satellite', 'dark-gray']
const KNOWN_LAYERS = ['earthquakes', 'hurricanes']

const state: UrlState = {
  basemap: 'topo',
  center: [-122.41941, 37.77492],
  zoom: 12.25,
  visibleLayers: ['earthquakes', 'hurricanes'],
}

describe('serializeUrlState', () => {
  it('serializes all fields in a stable format', () => {
    expect(serializeUrlState(state)).toBe(
      'b=topo&c=-122.4194%2C37.7749&z=12.25&l=earthquakes%2Churricanes',
    )
  })

  it('omits the layer param when nothing is visible', () => {
    const hash = serializeUrlState({ ...state, visibleLayers: [] })
    expect(hash).toBe('b=topo&c=-122.4194%2C37.7749&z=12.25')
  })
})

describe('parseUrlState', () => {
  it('round-trips through serialize', () => {
    const parsed = parseUrlState(`#${serializeUrlState(state)}`, {
      knownBasemaps: KNOWN_BASEMAPS,
      knownLayerIds: KNOWN_LAYERS,
    })
    expect(parsed).toEqual({
      basemap: 'topo',
      center: [-122.4194, 37.7749],
      zoom: 12.25,
      visibleLayers: ['earthquakes', 'hurricanes'],
    })
  })

  it('accepts a hash without the leading #', () => {
    const parsed = parseUrlState('b=osm&c=-98.5,39.8&z=4&l=earthquakes', {
      knownBasemaps: KNOWN_BASEMAPS,
      knownLayerIds: KNOWN_LAYERS,
    })
    expect(parsed).toEqual({
      basemap: 'osm',
      center: [-98.5, 39.8],
      zoom: 4,
      visibleLayers: ['earthquakes'],
    })
  })

  it('returns an empty object for an empty hash', () => {
    expect(parseUrlState('')).toEqual({})
    expect(parseUrlState('#')).toEqual({})
  })

  it('drops unknown basemaps and layer ids', () => {
    const parsed = parseUrlState('b=bogus&c=0,0&z=4&l=earthquakes,bogus', {
      knownBasemaps: KNOWN_BASEMAPS,
      knownLayerIds: KNOWN_LAYERS,
    })
    expect(parsed.basemap).toBeUndefined()
    expect(parsed.visibleLayers).toEqual(['earthquakes'])
  })

  it('rejects out-of-range coordinates and non-numeric values', () => {
    expect(parseUrlState('c=200,39.8&z=4').center).toBeUndefined()
    expect(parseUrlState('c=-98.5,95&z=4').center).toBeUndefined()
    expect(parseUrlState('c=abc,def&z=4').center).toBeUndefined()
    expect(parseUrlState('z=banana').zoom).toBeUndefined()
  })

  it('clamps zoom into a sane range', () => {
    expect(parseUrlState('z=0').zoom).toBe(1)
    expect(parseUrlState('z=99').zoom).toBe(20)
  })
})
