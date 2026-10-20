import { describe, expect, it } from 'vitest'
import { listRegions, lookupRegion, parseNlQuery } from './parser'

describe('parseNlQuery', () => {
  it('parses a magnitude filter', () => {
    expect(parseNlQuery('show M6+ earthquakes')).toEqual([{ kind: 'filter-magnitude', min: 6 }])
    expect(parseNlQuery('magnitude 4.5 and higher')).toEqual([
      { kind: 'filter-magnitude', min: 4.5 },
    ])
  })

  it('parses combined commands in a stable order', () => {
    expect(parseNlQuery('show M5+ in California from the last 3 days')).toEqual([
      { kind: 'filter-magnitude', min: 5 },
      { kind: 'filter-region', region: 'California' },
      { kind: 'time-window', startHoursAgo: 72, endHoursAgo: 0 },
    ])
  })

  it('parses time windows in hours', () => {
    expect(parseNlQuery('last 12 hours')).toEqual([
      { kind: 'time-window', startHoursAgo: 12, endHoursAgo: 0 },
    ])
    expect(parseNlQuery('today')).toEqual([
      { kind: 'time-window', startHoursAgo: 24, endHoursAgo: 0 },
    ])
    expect(parseNlQuery('past 2 weeks')).toEqual([
      { kind: 'time-window', startHoursAgo: 336, endHoursAgo: 0 },
    ])
  })

  it('parses clear commands', () => {
    expect(parseNlQuery('clear filters')).toEqual([{ kind: 'clear-filters' }])
    expect(parseNlQuery('reset')).toEqual([{ kind: 'clear-filters' }])
  })

  it('parses zoom commands to known regions', () => {
    expect(parseNlQuery('zoom to Japan')).toEqual([{ kind: 'zoom-to', region: 'Japan' }])
  })

  it('returns unknown for unrecognized input', () => {
    expect(parseNlQuery('what is the weather?')).toEqual([{ kind: 'unknown' }])
    expect(parseNlQuery('')).toEqual([{ kind: 'unknown' }])
  })
})

describe('lookupRegion', () => {
  it('matches direct names, state codes, and qualified names', () => {
    expect(lookupRegion('California')?.label).toBe('California')
    expect(lookupRegion('CA')?.where).toContain("LIKE '%, CA'")
    expect(lookupRegion('northern california')?.label).toBe('California')
    expect(lookupRegion('atlantis')).toBeNull()
  })

  it('builds USGS place-LIKE patterns', () => {
    expect(lookupRegion('Japan')?.where).toBe(`place LIKE '%, Japan'`)
  })

  it('lists every supported region for help text', () => {
    expect(listRegions().length).toBeGreaterThanOrEqual(10)
  })
})
