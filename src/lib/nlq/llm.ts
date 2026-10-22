/**
 * Optional LLM path for the NLQ panel: a tool-use turn turns free-form
 * language into the same intents the rule-based parser produces.
 *
 * Anthropic speaks its native Messages API; OpenAI and OpenCode Zen use the
 * OpenAI-compatible Chat Completions API. Any failure returns null so the
 * caller falls back to the offline rule-based parser.
 */
import type { LlmConfig } from './llmConfig'
import type { NlqIntent } from './parser'

interface ToolDefinition {
  readonly name: string
  readonly description: string
  readonly parameters: Record<string, unknown>
}

const TOOLS: readonly ToolDefinition[] = [
  {
    name: 'filter_by_magnitude',
    description: 'Filter earthquakes by minimum magnitude (0-10).',
    parameters: {
      type: 'object',
      properties: { min: { type: 'number' } },
      required: ['min'],
    },
  },
  {
    name: 'filter_by_region',
    description: 'Filter earthquakes to a named US state or country in the place string.',
    parameters: {
      type: 'object',
      properties: { region: { type: 'string' } },
      required: ['region'],
    },
  },
  {
    name: 'set_time_window',
    description: 'Show earthquakes within a window ending now, starting hours_ago back.',
    parameters: {
      type: 'object',
      properties: { hours_ago: { type: 'number' } },
      required: ['hours_ago'],
    },
  },
  {
    name: 'clear_filters',
    description: 'Remove all filters and reset the time window.',
    parameters: { type: 'object', properties: {} },
  },
]

const SYSTEM =
  'You translate natural-language mapping requests into tool calls for a live ' +
  'USGS earthquake map. Respond only with tool calls, never prose.'

interface ToolCall {
  readonly name: string
  readonly input: Record<string, unknown>
}

interface AnthropicBlock {
  type?: string
  name?: string
  input?: unknown
}

interface OpenAiToolCall {
  function?: {
    name?: string
    arguments?: unknown
  }
}

interface OpenAiMessage {
  tool_calls?: readonly OpenAiToolCall[]
  /** Deprecated, but still returned by some compatible gateways. */
  function_call?: {
    name?: string
    arguments?: unknown
  }
}

/** Narrows an untrusted JSON value to an object, ignoring arrays and scalars. */
function asRecord(value: unknown): Record<string, unknown> | null {
  // pi-lens-ignore: no-runtime-typeof
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** Parses OpenAI tool arguments, which arrive as a JSON string. */
function parseArguments(raw: unknown): Record<string, unknown> | null {
  if (raw === undefined || raw === null || raw === '') return {}
  // pi-lens-ignore: no-runtime-typeof
  if (typeof raw === 'object') return asRecord(raw)

  // pi-lens-ignore: no-runtime-typeof
  if (typeof raw !== 'string') return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return asRecord(parsed)
  } catch {
    // A model can hallucinate invalid JSON; drop this call and let any others
    // (or the offline parser) decide the outcome.
    return null
  }
}

function intentsFromToolCalls(calls: readonly ToolCall[]): NlqIntent[] | null {
  const intents: NlqIntent[] = []
  for (const call of calls) {
    const intent = intentFromToolCall(call)
    if (intent) intents.push(intent)
  }
  return intents.length > 0 ? intents : null
}

/** Accepts numbers and numeric strings (some models stringify arguments). */
function finiteNumber(value: unknown): number | null {
  // pi-lens-ignore: no-runtime-typeof
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  // pi-lens-ignore: no-runtime-typeof
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

function intentFromToolCall(call: ToolCall): NlqIntent | null {
  switch (call.name) {
    case 'filter_by_magnitude': {
      const min = finiteNumber(call.input.min)
      return min === null ? null : { kind: 'filter-magnitude', min }
    }
    case 'filter_by_region': {
      // Arguments come from an external API, so the shape is checked at
      // this boundary rather than trusted.
      const region = call.input.region
      // pi-lens-ignore: no-runtime-typeof
      return typeof region === 'string' && region.trim()
        ? { kind: 'filter-region', region: region.trim() }
        : null
    }
    case 'set_time_window': {
      const hours = finiteNumber(call.input.hours_ago)
      return hours === null ? null : { kind: 'time-window', startHoursAgo: hours, endHoursAgo: 0 }
    }
    case 'clear_filters':
      return { kind: 'clear-filters' }
    default:
      return null
  }
}

/** Anthropic Messages API tool-use turn. */
async function requestAnthropic(text: string, config: LlmConfig): Promise<ToolCall[]> {
  // `config.url` is validated at resolution time (http/https only) and comes
  // from build-time env, not runtime user input.
  const url = config.url
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      // Opt in to browser-side calls (this app is a keyless client-side demo).
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 400,
      system: SYSTEM,
      tools: TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      })),
      // Force a tool call so the reply is always machine-interpretable.
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: text }],
    }),
  })
  if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`)

  const data: { content?: readonly AnthropicBlock[] } = await res.json()
  const calls: ToolCall[] = []
  for (const block of data.content ?? []) {
    if (block.type !== 'tool_use' || !block.name) continue
    calls.push({ name: block.name, input: asRecord(block.input) ?? {} })
  }
  return calls
}

/** OpenAI-compatible Chat Completions tool-call turn (OpenAI, OpenCode Zen). */
async function requestOpenAiCompatible(text: string, config: LlmConfig): Promise<ToolCall[]> {
  // `config.url` is validated at resolution time (http/https only) and comes
  // from build-time env, not runtime user input.
  const url = config.url
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
      tools: TOOLS.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      // `auto` is the most widely supported choice across OpenAI-compatible
      // gateways; a prose reply falls back to the offline parser.
      tool_choice: 'auto',
    }),
  })
  if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`)

  const data: { choices?: readonly { message?: OpenAiMessage }[] } = await res.json()
  const message = data.choices?.[0]?.message
  const calls: ToolCall[] = []

  for (const call of message?.tool_calls ?? []) {
    const name = call.function?.name
    if (!name) continue
    const input = parseArguments(call.function?.arguments)
    if (input) calls.push({ name, input })
  }

  // Some compatible gateways still emit the deprecated single call shape;
  // only use it when the modern tool_calls array is absent.
  const legacy = message?.function_call
  if (calls.length === 0 && legacy?.name) {
    const input = parseArguments(legacy.arguments)
    if (input) calls.push({ name: legacy.name, input })
  }

  return calls
}

/**
 * Turns a command into intents through the configured provider.
 * Returns null on any failure (network, auth, status, or unexpected shape) so
 * the caller falls back to the offline rule-based parser.
 */
export async function intentFromLlm(text: string, config: LlmConfig): Promise<NlqIntent[] | null> {
  try {
    const calls =
      config.provider === 'anthropic'
        ? await requestAnthropic(text, config)
        : await requestOpenAiCompatible(text, config)
    return intentsFromToolCalls(calls)
  } catch {
    return null
  }
}
