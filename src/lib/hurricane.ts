/**
 * Tropical-cyclone classification.
 *
 * The feeds disagree on units and none of them ships a Saffir–Simpson category:
 * EONET reports wind in knots, GDACS in km/h, NHC in knots with its own
 * classification code. This module is the single place that turns a wind speed
 * into the category a reader expects, so the popups agree with each other.
 */

/** Saffir–Simpson thresholds in knots, lower bound inclusive. */
const SAFFIR_SIMPSON_KTS: readonly { min: number; label: string }[] = [
  { min: 137, label: 'Category 5' },
  { min: 113, label: 'Category 4' },
  { min: 96, label: 'Category 3' },
  { min: 83, label: 'Category 2' },
  { min: 64, label: 'Category 1' },
  { min: 34, label: 'Tropical storm' },
  { min: 0, label: 'Tropical depression' },
]

const KMH_PER_KT = 1.852

/** Converts a wind speed to knots. Unknown units are assumed to be knots. */
export function toKnots(
  value: number | null | undefined,
  unit: string | null | undefined,
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const normalised = (unit ?? '').trim().toLowerCase()
  if (normalised === 'km/h' || normalised === 'kmh' || normalised === 'kph') {
    return value / KMH_PER_KT
  }
  if (normalised === 'mph') return value * 0.868976
  if (normalised === 'm/s' || normalised === 'ms') return value * 1.943844
  return value
}

/**
 * The Saffir–Simpson category for a wind speed, e.g. (95, 'kts') → "Category 2".
 * Returns null when there is no usable wind speed, so callers can omit the row
 * instead of printing a dash where a judgement belongs.
 */
export function saffirSimpson(
  wind: number | null | undefined,
  unit: string | null | undefined,
): string | null {
  const knots = toKnots(wind, unit)
  if (knots === null) return null
  const band = SAFFIR_SIMPSON_KTS.find((entry) => knots >= entry.min)
  return band ? band.label : null
}
