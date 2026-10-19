import { describe, expect, it } from 'vitest'
import {
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

describe('buildQuakePopupHtml', () => {
  const attrs: QuakeAttributes = {
    name: 'Sumatra',
    magnitude: 7.5,
    year_: 2004,
    mo: 12,
    dy: 26,
    num_deaths: 227898,
    mill_damages: null,
  }

  it('includes magnitude, date, and formatted stats', () => {
    const html = buildQuakePopupHtml(attrs)
    // The quake name belongs to the popup title template, not the content body.
    expect(html).not.toContain('Sumatra')
    expect(html).toContain('7.5')
    expect(html).toContain('Dec 26, 2004')
    expect(html).toContain('227,898')
  })

  it('renders em dashes for missing values', () => {
    const html = buildQuakePopupHtml({ ...attrs, name: null, num_deaths: null })
    expect(html).toContain('—')
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
