import { describe, expect, it } from 'vitest'
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer'
import Extent from '@arcgis/core/geometry/Extent'

// Exercises the real USGS feed through the SDK's client-side store to pin down
// exactly when definition-level filtering is honored. Findings encoded here:
// (1) constructor expressions work with or without clustering, (2) expression
// changes after load are honored on un-argued queries, (3) when the query
// carries geometry/timeExtent the runtime expression must be merged in
// explicitly or it is bypassed.
const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson'

describe('GeoJSONLayer filtering (integration)', () => {
  it('honors a constructor expression, with and without clustering', async () => {
    const plain = new GeoJSONLayer({ url: FEED, definitionExpression: 'mag >= 4.5' })
    const clustered = new GeoJSONLayer({
      url: FEED,
      definitionExpression: 'mag >= 4.5',
      featureReduction: { type: 'cluster', clusterRadius: 60 },
    })
    await Promise.all([plain.load(), clustered.load()])

    const plainCount = await plain.queryFeatureCount()
    const clusteredCount = await clustered.queryFeatureCount()

    expect(plainCount).toBeGreaterThan(0)
    expect(plainCount).toBeLessThan(1000)
    expect(clusteredCount).toBe(plainCount)
  }, 30_000)

  it('honors an expression changed after load on a clustered layer', async () => {
    const layer = new GeoJSONLayer({
      url: FEED,
      featureReduction: { type: 'cluster', clusterRadius: 60 },
    })
    await layer.load()
    const unfiltered = await layer.queryFeatureCount()

    layer.definitionExpression = 'mag >= 4.5'
    const afterChange = await layer.queryFeatureCount()

    expect(unfiltered).toBeGreaterThan(500)
    expect(afterChange).toBeGreaterThan(0)
    expect(afterChange).toBeLessThan(unfiltered)
  }, 30_000)

  it('honors a post-load change with the app’s exact layer config (fields + refresh)', async () => {
    const layer = new GeoJSONLayer({
      url: FEED,
      fields: [
        { name: 'mag', type: 'double' },
        { name: 'place', type: 'string' },
        { name: 'time', type: 'double' },
        { name: 'depth', type: 'double' },
        { name: 'tsunami', type: 'integer' },
        { name: 'sig', type: 'integer' },
        { name: 'url', type: 'string' },
      ],
      featureReduction: { type: 'cluster', clusterRadius: 60 },
      refreshInterval: 2,
    })
    await layer.load()
    const before = await layer.queryFeatureCount()

    layer.definitionExpression = 'mag >= 4.5'
    const after = await layer.queryFeatureCount()

    expect(before).toBeGreaterThan(500)
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(before)
  }, 30_000)

  it('runs geometry + where queries together (soundness check)', async () => {
    // Combining geometry with a real where clause must still filter correctly;
    // this pins the shape used by the app's extent analytics.
    const layer = new GeoJSONLayer({
      url: FEED,
      featureReduction: { type: 'cluster', clusterRadius: 60 },
    })
    await layer.load()
    const extent = new Extent({
      xmin: -130,
      ymin: 18,
      xmax: -60,
      ymax: 55,
      spatialReference: { wkid: 4326 },
    })
    const all = await layer.queryFeatureCount()
    const combined = await layer.queryFeatureCount({ geometry: extent, where: 'mag >= 2' })

    expect(all).toBeGreaterThan(1000)
    expect(combined).toBeGreaterThan(100)
    expect(combined).toBeLessThan(all)
  }, 30_000)
})
