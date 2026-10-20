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
    const quakeLayer = targets.layers.find((layer) => layer.id === 'earthquakes')
    const replies: string[] = []

    for (const intent of intents) {
      switch (intent.kind) {
        case 'clear-filters': {
          state.magMin = null
          state.regionWhere = null
          state.regionLabel = null
          if (quakeLayer) {
            targets.applyQuakeFilter(null)
          }
          const full = targets.timeSlider?.fullTimeExtent
          if (targets.timeSlider && full?.start && full?.end) {
            targets.timeSlider.timeExtent = { start: full.start, end: full.end }
          }
          replies.push('Filters cleared — showing everything in the current time window.')
          break
        }

        case 'filter-magnitude': {
          state.magMin = intent.min
          if (quakeLayer) {
            targets.applyQuakeFilter(quakeWhere(state))
          }
          replies.push(
            `Showing M${intent.min}+ quakes${state.regionLabel ? ` in ${state.regionLabel}` : ''}.`,
          )
          break
        }

        case 'filter-region': {
          const region = lookupRegion(intent.region)
          if (!region) {
            replies.push(`I don't know that region. ${NLQ_HELP}`)
            break
          }
          state.regionWhere = region.where
          state.regionLabel = region.label
          if (quakeLayer) {
            targets.applyQuakeFilter(quakeWhere(state))
          }
          replies.push(
            `Showing quakes in ${region.label}${state.magMin !== null ? ` (M${state.magMin}+)` : ''}.`,
          )
          break
        }

        case 'time-window': {
          const slider = targets.timeSlider
          if (!slider) {
            replies.push('The time slider is not available.')
            break
          }
          const now = Date.now()
          slider.timeExtent = {
            start: new Date(now - intent.startHoursAgo * HOUR_MS),
            end: new Date(now - intent.endHoursAgo * HOUR_MS),
          }
          const hours = intent.startHoursAgo
          replies.push(
            hours >= 24
              ? `Showing the last ${Math.round(hours / 24)} day(s).`
              : `Showing the last ${Math.round(hours * 60)} minute(s).`,
          )
          break
        }

        case 'zoom-to': {
          const region = lookupRegion(intent.region)
          if (!region) {
            replies.push(`I can zoom to: ${listRegions().join(', ')}.`)
            break
          }
          await targets.view.goTo({ center: region.center, zoom: region.zoom })
          replies.push(`Zoomed to ${region.label}.`)
          break
        }

        case 'unknown': {
          replies.push(NLQ_HELP)
          break
        }

        default:
          break
      }
    }

    return replies.join(' ')
  }
}
