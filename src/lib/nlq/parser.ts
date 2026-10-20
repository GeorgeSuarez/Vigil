/**
 * Pure natural-language intent parsing for map commands — no network, no SDK,
 * fully deterministic and unit-testable. This is the keyless baseline for the
 * NLQ panel; an LLM (see llm.ts) can produce the same intents when configured.
 *
 * Example: "show M6+ earthquakes in California from the last 3 days"
 *   → [filter-magnitude(6), filter-region(California), time-window(72h → now)]
 */

export type NlqIntent =
  | { kind: 'clear-filters' }
  | { kind: 'filter-magnitude'; min: number }
  | { kind: 'filter-region'; region: string }
  | { kind: 'time-window'; startHoursAgo: number; endHoursAgo: number }
  | { kind: 'zoom-to'; region: string }
  | { kind: 'unknown' }

/** Known places: a place-LIKE filter plus a zoom target. */
export interface RegionInfo {
  label: string
  /** SQL LIKE pattern matching USGS `place` strings ("12 km NE of Barstow, CA"). */
  where: string
  center: [number, number]
  zoom: number
}

const REGIONS = {
  california: { label: 'California', where: `place LIKE '%, CA'`, center: [-119.4, 36.7], zoom: 6 },
  alaska: { label: 'Alaska', where: `place LIKE '%, AK'`, center: [-152, 64], zoom: 5 },
  nevada: { label: 'Nevada', where: `place LIKE '%, NV'`, center: [-117, 39.5], zoom: 6 },
  texas: { label: 'Texas', where: `place LIKE '%, TX'`, center: [-99, 31], zoom: 5.5 },
  hawaii: { label: 'Hawaii', where: `place LIKE '%, HI'`, center: [-157.5, 20.8], zoom: 7 },
  oklahoma: { label: 'Oklahoma', where: `place LIKE '%, OK'`, center: [-97.5, 35.5], zoom: 6 },
  japan: { label: 'Japan', where: `place LIKE '%, Japan'`, center: [138, 37], zoom: 5 },
  chile: { label: 'Chile', where: `place LIKE '%, Chile'`, center: [-71, -35], zoom: 4.5 },
  indonesia: {
    label: 'Indonesia',
    where: `place LIKE '%, Indonesia'`,
    center: [113, -2],
    zoom: 4.5,
  },
  'new zealand': {
    label: 'New Zealand',
    where: `place LIKE '%, New Zealand'`,
    center: [172, -41],
    zoom: 5,
  },
  iceland: { label: 'Iceland', where: `place LIKE '%, Iceland'`, center: [-18.5, 65], zoom: 6 },
  italy: { label: 'Italy', where: `place LIKE '%, Italy'`, center: [12.5, 42.5], zoom: 5.5 },
} satisfies Record<string, RegionInfo>

const STATE_CODES = {
  ca: 'california',
  ak: 'alaska',
  nv: 'nevada',
  tx: 'texas',
  hi: 'hawaii',
  ok: 'oklahoma',
} satisfies Record<string, string>

export const NLQ_HELP =
  'Try: "show M6+ earthquakes", "M5 in Alaska", "zoom to Japan", "last 3 days", "today", "clear filters".'

/** Resolves a free-text region ("northern california", "CA") to a known region. */
export function lookupRegion(raw: string): RegionInfo | null {
  const name = raw
    .trim()
    .toLowerCase()
    .replace(/\bthe\b/g, '')
    .replace(/\s+/g, ' ')
  if (name in REGIONS) return REGIONS[name as keyof typeof REGIONS]
  if (name in STATE_CODES) {
    return REGIONS[STATE_CODES[name as keyof typeof STATE_CODES] as keyof typeof REGIONS]
  }
  // Suffix match handles qualifiers like "northern california".
  for (const [key, value] of Object.entries(REGIONS)) {
    if (name.endsWith(` ${key}`) || name === key) return value
  }
  return null
}

export function listRegions(): string[] {
  return Object.values(REGIONS).map((r) => r.label)
}

const MAG_RE = /\b(?:magnitude|m)\s*(\d(?:\.\d)?)\s*(?:\+|and\s+(?:above|higher|greater|up)\b)?/i
const ZOOM_RE = /\b(?:zoom to|go to|fly to)\s+([a-z ]+)/i
// Lazy capture stops at time/qualifier words: "in California from the last 3 days"
// captures just "California".
const IN_RE = /\bin\s+([a-z ]+?)\s*(?:from|for|during|over|since|between)\b|\bin\s+([a-z ]+)/i
const LAST_N_RE =
  /\b(?:last|past|previous|in the last)\s+(\d+)\s+(minute|minutes|min|hour|hours|day|days|week|weeks)\b/i
const WORD_TIME_RE = /\b(?:today|last day|past day|this week|last week|past week)\b/i

const UNIT_HOURS = {
  minute: 1 / 60,
  minutes: 1 / 60,
  min: 1 / 60,
  hour: 1,
  hours: 1,
  day: 24,
  days: 24,
  week: 24 * 7,
  weeks: 24 * 7,
} satisfies Record<string, number>

/** Parses a user command into an ordered list of intents. Empty input → [unknown]. */
export function parseNlQuery(text: string): NlqIntent[] {
  // Regexes are case-insensitive; the original casing is preserved in captures
  // so region names read naturally in replies and intents.
  const input = text.trim()
  if (!input) return [{ kind: 'unknown' }]

  const intents: NlqIntent[] = []

  if (/\b(?:clear|reset|remove)\b/i.test(input) || /\bshow (?:all|everything)\b/i.test(input)) {
    intents.push({ kind: 'clear-filters' })
  }

  const mag = MAG_RE.exec(input)
  if (mag) intents.push({ kind: 'filter-magnitude', min: Number(mag[1]) })

  const regionIn = IN_RE.exec(input)
  const regionName = regionIn?.[1] ?? regionIn?.[2]
  if (regionName && lookupRegion(regionName)) {
    intents.push({ kind: 'filter-region', region: regionName.trim() })
  }

  let windowHours: number | null = null
  const lastN = LAST_N_RE.exec(input)
  if (lastN) {
    const unit = UNIT_HOURS[lastN[2] as keyof typeof UNIT_HOURS]
    windowHours = Number(lastN[1]) * unit
  } else if (WORD_TIME_RE.test(input)) {
    windowHours = /\b(?:today|last day|past day)\b/i.test(input) ? 24 : 24 * 7
  }
  if (windowHours !== null) {
    intents.push({ kind: 'time-window', startHoursAgo: windowHours, endHoursAgo: 0 })
  }

  const zoom = ZOOM_RE.exec(input)
  if (zoom) {
    intents.push({ kind: 'zoom-to', region: zoom[1].trim() })
  }

  return intents.length > 0 ? intents : [{ kind: 'unknown' }]
}
