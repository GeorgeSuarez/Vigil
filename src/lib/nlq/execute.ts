/**
 * Executes parsed NLQ intents against the live map. SDK-facing (needs the
 * view/layers/slider), but fully deterministic — the LLM and the rule-based
 * parser both funnel into the same intents.
 */
import type MapView from '@arcgis/core/views/MapView'
import type TimeSlider from '@arcgis/core/widgets/TimeSlider'
import type { AppLayer } from '../layers'
import { listRegions, lookupRegion, NLQ_HELP, type NlqIntent } from './parser'

export interface NlqTargets {
  view: MapView
  layers: readonly AppLayer[]
  timeSlider: TimeSlider | null
  refreshExtentStats: () => void
  applyQuakeFilter: (where: string | null) => void
}

const HOUR_MS = 3_600_000

interface FilterState {
  magMin: number | null
  regionWhere: string | null
  regionLabel: string | null
}

function quakeWhere(state: FilterState): string | null {
  const clauses: string[] = []
  if (state.magMin !== null) clauses.push(`mag >= ${state.magMin}`)
  if (state.regionWhere) clauses.push(state.regionWhere)
  return clauses.length > 0 ? clauses.join(' AND ') : null
}

/** Everything an intent handler needs, resolved once per command. */
interface IntentContext {
  targets: NlqTargets
  /** Session state — filters persist across commands. */
  state: FilterState
  quakeLayer: AppLayer | undefined
}

function clearFilters(ctx: IntentContext): string {
  ctx.state.magMin = null
  ctx.state.regionWhere = null
  ctx.state.regionLabel = null
  if (ctx.quakeLayer) {
    ctx.targets.applyQuakeFilter(null)
  }
  const full = ctx.targets.timeSlider?.fullTimeExtent
  if (ctx.targets.timeSlider && full?.start && full?.end) {
    ctx.targets.timeSlider.timeExtent = { start: full.start, end: full.end }
  }
  return 'Filters cleared — showing everything in the current time window.'
}

function filterByMagnitude(
  intent: Extract<NlqIntent, { kind: 'filter-magnitude' }>,
  ctx: IntentContext,
): string {
  ctx.state.magMin = intent.min
  if (ctx.quakeLayer) {
    ctx.targets.applyQuakeFilter(quakeWhere(ctx.state))
  }
  return `Showing M${intent.min}+ quakes${ctx.state.regionLabel ? ` in ${ctx.state.regionLabel}` : ''}.`
}

function filterByRegion(
  intent: Extract<NlqIntent, { kind: 'filter-region' }>,
  ctx: IntentContext,
): string {
  const region = lookupRegion(intent.region)
  if (!region) {
    return `I don't know that region. ${NLQ_HELP}`
  }
  ctx.state.regionWhere = region.where
  ctx.state.regionLabel = region.label
  if (ctx.quakeLayer) {
    ctx.targets.applyQuakeFilter(quakeWhere(ctx.state))
  }
  return `Showing quakes in ${region.label}${ctx.state.magMin !== null ? ` (M${ctx.state.magMin}+)` : ''}.`
}

function setTimeWindow(
  intent: Extract<NlqIntent, { kind: 'time-window' }>,
  ctx: IntentContext,
): string {
  const slider = ctx.targets.timeSlider
  if (!slider) {
    return 'The time slider is not available.'
  }
  const now = Date.now()
  slider.timeExtent = {
    start: new Date(now - intent.startHoursAgo * HOUR_MS),
    end: new Date(now - intent.endHoursAgo * HOUR_MS),
  }
  return intent.startHoursAgo >= 24
    ? `Showing the last ${Math.round(intent.startHoursAgo / 24)} day(s).`
    : `Showing the last ${Math.round(intent.startHoursAgo * 60)} minute(s).`
}

async function zoomTo(
  intent: Extract<NlqIntent, { kind: 'zoom-to' }>,
  ctx: IntentContext,
): Promise<string> {
  const region = lookupRegion(intent.region)
  if (!region) {
    return `I can zoom to: ${listRegions().join(', ')}.`
  }
  await ctx.targets.view.goTo({ center: region.center, zoom: region.zoom })
  return `Zoomed to ${region.label}.`
}

async function handleIntent(intent: NlqIntent, ctx: IntentContext): Promise<string> {
  switch (intent.kind) {
    case 'clear-filters':
      return clearFilters(ctx)
    case 'filter-magnitude':
      return filterByMagnitude(intent, ctx)
    case 'filter-region':
      return filterByRegion(intent, ctx)
    case 'time-window':
      return setTimeWindow(intent, ctx)
    case 'zoom-to':
      return zoomTo(intent, ctx)
    default:
      return NLQ_HELP
  }
}

/**
 * Builds an executor that keeps session filter state across commands. The
 * live map targets are resolved at call time via `getTargets` — React
 * StrictMode recreates the map container, so holding a stale snapshot would
 * silently mutate a destroyed layer.
 */
export function createNlqExecutor(
  getTargets: () => NlqTargets | null,
): (intents: readonly NlqIntent[]) => Promise<string> {
  const state: FilterState = { magMin: null, regionWhere: null, regionLabel: null }

  return async (intents) => {
    const targets = getTargets()
    if (!targets) return 'The map is still loading — try again in a moment.'
    const ctx: IntentContext = {
      targets,
      state,
      quakeLayer: targets.layers.find((layer) => layer.id === 'earthquakes'),
    }
    const replies: string[] = []
    for (const intent of intents) {
      replies.push(await handleIntent(intent, ctx))
    }
    return replies.join(' ')
  }
}
