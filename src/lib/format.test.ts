import { describe, expect, it } from 'vitest'
import { formatDegrees, formatEpoch, formatNullable, formatNumber, formatScale } from './format'

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('passes small numbers through', () => {
    expect(formatNumber(42)).toBe('42')
  })
})

describe('formatNullable', () => {
  it('falls back for null and undefined', () => {
    expect(formatNullable(null)).toBe('—')
    expect(formatNullable(undefined)).toBe('—')
    expect(formatNullable('')).toBe('—')
  })

  it('stringifies real values', () => {
    expect(formatNullable(0)).toBe('0')
    expect(formatNullable('abc')).toBe('abc')
  })

  it('supports custom fallbacks', () => {
    expect(formatNullable(null, 'n/a')).toBe('n/a')
  })
})

describe('formatDegrees', () => {
  it('formats latitude with hemisphere', () => {
    expect(formatDegrees(37.4419, 'lat')).toBe('37.4419° N')
    expect(formatDegrees(-33.8688, 'lat')).toBe('33.8688° S')
  })

  it('formats longitude with hemisphere', () => {
    expect(formatDegrees(-122.138, 'lon')).toBe('122.1380° W')
    expect(formatDegrees(151.2093, 'lon')).toBe('151.2093° E')
  })

  it('falls back for missing values', () => {
    expect(formatDegrees(null, 'lat')).toBe('—')
  })
})

describe('formatScale', () => {
  it('compacts large denominators', () => {
    expect(formatScale(2_340_000)).toBe('1 : 2.3M')
    expect(formatScale(12_500)).toBe('1 : 12.5K')
    expect(formatScale(500)).toBe('1 : 500')
  })

  it('falls back for missing or invalid values', () => {
    expect(formatScale(null)).toBe('—')
    expect(formatScale(0)).toBe('—')
  })
})

describe('formatEpoch', () => {
  it('formats epoch ms as a UTC timestamp', () => {
    expect(formatEpoch(1792460072709)).toMatch(/UTC$/)
    expect(formatEpoch(0)).toMatch(/^Jan 1, 1970, 00:00 UTC$/)
  })

  it('falls back for missing values', () => {
    expect(formatEpoch(null)).toBe('—')
    expect(formatEpoch(Number.NaN)).toBe('—')
  })
})
