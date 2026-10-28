import { describe, expect, it } from 'vitest'
import { saffirSimpson, toKnots } from './hurricane'

describe('toKnots', () => {
  it('passes knots through untouched', () => {
    expect(toKnots(95, 'kts')).toBe(95)
    expect(toKnots(95, null)).toBe(95)
  })

  it('converts km/h, mph and m/s', () => {
    expect(toKnots(296.2944, 'km/h')).toBeCloseTo(159.99, 1)
    expect(toKnots(115, 'mph')).toBeCloseTo(99.9, 1)
    expect(toKnots(50, 'm/s')).toBeCloseTo(97.2, 1)
  })

  it('returns null for missing or non-finite values', () => {
    expect(toKnots(null, 'kts')).toBeNull()
    expect(toKnots(undefined, 'kts')).toBeNull()
    expect(toKnots(Number.NaN, 'kts')).toBeNull()
  })
})

describe('saffirSimpson', () => {
  it('maps each band at its lower bound', () => {
    expect(saffirSimpson(137, 'kts')).toBe('Category 5')
    expect(saffirSimpson(113, 'kts')).toBe('Category 4')
    expect(saffirSimpson(96, 'kts')).toBe('Category 3')
    expect(saffirSimpson(83, 'kts')).toBe('Category 2')
    expect(saffirSimpson(64, 'kts')).toBe('Category 1')
    expect(saffirSimpson(34, 'kts')).toBe('Tropical storm')
    expect(saffirSimpson(10, 'kts')).toBe('Tropical depression')
  })

  it('classifies the storm from the screenshot feed values', () => {
    // EONET reported Champi at 95 kts; GDACS at 296 km/h.
    expect(saffirSimpson(95, 'kts')).toBe('Category 2')
    expect(saffirSimpson(296.2944, 'km/h')).toBe('Category 5')
  })

  it('returns null rather than guessing when there is no wind speed', () => {
    expect(saffirSimpson(null, 'kts')).toBeNull()
    expect(saffirSimpson(Number.NaN, 'kts')).toBeNull()
  })
})
