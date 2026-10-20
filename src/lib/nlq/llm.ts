/**
 * Optional LLM path for the NLQ panel: Anthropic tool-use turns free-form
 * language into the same intents the rule-based parser produces. Gated on
 * VITE_ANTHROPIC_API_KEY; failures fall back to the rule-based parser.
 */
import type { NlqIntent } from './parser'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const TOOLS = [
  {
    name: 'filter_by_magnitude',
    description: 'Filter earthquakes by minimum magnitude (0-10).',
    input_schema: {
      type: 'object' as const,
      properties: { min: { type: 'number' } },
      required: ['min'],
    },
  },
  {
    name: 'filter_by_region',
    description: 'Filter earthquakes to a named US state or country in the place string.',
    input_schema: {
      type: 'object' as const,
      properties: { region: { type: 'string' } },
      required: ['region'],
    },
  },
  {
    name: 'set_time_window',
    description: 'Show earthquakes within a window ending now, starting hours_ago back.',
    input_schema: {
      type: 'object' as const,
      properties: { hours_ago: { type: 'number' } },
      required: ['hours_ago'],
    },
  },
  {
    name: 'clear_filters',
    description: 'Remove all filters and reset the time window.',
    input_schema: { type: 'object' as const, properties: {} },
  },
]

const SYSTEM =
  'You translate natural-language mapping requests into tool calls for a live ' +
  'USGS earthquake map. Respond only with tool calls, never prose.'

interface ContentBlock {
  type: string
  name?: string
  /** Tool-call arguments, keyed per tool; each handler narrows its own. */
  input?: {
    min?: unknown
    region?: unknown
    hours_ago?: unknown
  }
}

/** Sends the request and maps any tool_use blocks back to NlqIntents.
 * Returns null on any failure (network, status, or unexpected shape) so the
 * caller falls back to the offline rule-based parser. */
export async function intentFromLlm(
  text: string,
  apiKey: string,
  model: string,
): Promise<NlqIntent[] | null> {
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Opt in to browser-side calls (this app is a keyless client-side demo).
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system: SYSTEM,
        tools: TOOLS,
        // Force a tool call so the reply is always machine-interpretable.
        tool_choice: { type: 'any' },
        messages: [{ role: 'user', content: text }],
      }),
    })
    if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`)

    const data: { content?: ContentBlock[] } = await res.json()
    const intents: NlqIntent[] = []

    for (const block of data.content ?? []) {
      if (block.type !== 'tool_use') continue
      switch (block.name) {
        case 'filter_by_magnitude': {
          const min = Number(block.input?.min)
          if (Number.isFinite(min)) intents.push({ kind: 'filter-magnitude', min })
          break
        }
        case 'filter_by_region': {
          // Arguments come from an external API, so the shape is checked at
          // this boundary rather than trusted.
          // pi-lens-ignore: no-runtime-typeof
          if (typeof block.input?.region === 'string') {
            intents.push({ kind: 'filter-region', region: block.input.region })
          }
          break
        }
        case 'set_time_window': {
          const hours = Number(block.input?.hours_ago)
          if (Number.isFinite(hours)) {
            intents.push({ kind: 'time-window', startHoursAgo: hours, endHoursAgo: 0 })
          }
          break
        }
        case 'clear_filters': {
          intents.push({ kind: 'clear-filters' })
          break
        }
        default:
          break
      }
    }

    if (intents.length === 0) intents.push({ kind: 'unknown' })
    return intents
  } catch {
    // Network, auth, or shape failure — the caller falls back to the offline
    // rule-based parser.
    return null
  }
}
