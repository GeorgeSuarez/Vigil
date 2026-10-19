/** Framework-agnostic formatting helpers. Kept pure so they are trivially testable. */

/** Formats a number with thousands separators, e.g. 1234567 → "1,234,567". */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/** Formats a nullable value with a readable fallback. */
export function formatNullable(value: string | number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

/**
 * Formats a coordinate as degrees with a hemisphere suffix,
 * e.g. (37.4419, 'lat') → "37.4419° N".
 */
export function formatDegrees(value: number | null | undefined, axis: 'lat' | 'lon'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const hemisphere = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  return `${Math.abs(value).toFixed(4)}° ${hemisphere}`
}

/**
 * Compactly formats a map scale denominator, e.g. 2340000 → "1 : 2.3M".
 */
export function formatScale(scale: number | null | undefined): string {
  if (scale === null || scale === undefined || scale <= 0) return '—'
  if (scale >= 1_000_000) return `1 : ${(scale / 1_000_000).toFixed(1)}M`
  if (scale >= 1_000) return `1 : ${(scale / 1_000).toFixed(1)}K`
  return `1 : ${Math.round(scale)}`
}
