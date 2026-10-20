/** Framework-agnostic formatting helpers. Kept pure so they are trivially testable. */

const NUMBER_FORMAT = new Intl.NumberFormat('en-US')

/** Formats a number with thousands separators, e.g. 1234567 → "1,234,567";
 * invalid or missing values read as "—". */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return NUMBER_FORMAT.format(value)
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
  let hemisphere: string
  if (axis === 'lat') {
    hemisphere = value >= 0 ? 'N' : 'S'
  } else {
    hemisphere = value >= 0 ? 'E' : 'W'
  }
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

/**
 * Formats USGS-style epoch milliseconds as a UTC timestamp,
 * e.g. 1792460072709 → "Jul 18, 2026, 06:14 UTC".
 */
const EPOCH_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

export function formatEpoch(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
  return `${EPOCH_FORMAT.format(new Date(ms))} UTC`
}

/** Labels in the layer descriptors are plural; the status bar shows counts,
 * so a lone feature reads “1 quake”, not “1 quakes”. */
export function withCountLabel(count: number, pluralLabel: string): string {
  if (count === 1 && pluralLabel.endsWith('s') && pluralLabel.length > 1) {
    return pluralLabel.slice(0, -1)
  }
  return pluralLabel
}
