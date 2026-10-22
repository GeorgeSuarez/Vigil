/**
 * Provider-agnostic configuration for the optional NLQ LLM path.
 *
 * Generic env vars (`VITE_LLM_*`) work with any supported provider. The
 * provider-specific aliases (`VITE_OPENAI_API_KEY`, `VITE_OPENCODE_API_KEY`,
 * `VITE_ANTHROPIC_API_KEY`) select their provider automatically, so pasting a
 * single key is enough. Legacy Anthropic env vars keep working.
 */

export type LlmProvider = 'anthropic' | 'openai' | 'opencode'

export interface LlmConfig {
  readonly provider: LlmProvider
  readonly apiKey: string
  readonly model: string
  /** Full request URL (base URL + provider endpoint path). */
  readonly url: string
}

/** Subset of `ImportMetaEnv` read by the resolver. Plain object for tests. */
export interface LlmEnv {
  readonly VITE_LLM_PROVIDER?: string
  readonly VITE_LLM_API_KEY?: string
  readonly VITE_LLM_MODEL?: string
  readonly VITE_LLM_BASE_URL?: string
  readonly VITE_ANTHROPIC_API_KEY?: string
  readonly VITE_ANTHROPIC_MODEL?: string
  readonly VITE_OPENAI_API_KEY?: string
  readonly VITE_OPENAI_MODEL?: string
  readonly VITE_OPENCODE_API_KEY?: string
  readonly VITE_OPENCODE_MODEL?: string
}

interface ProviderDefaults {
  readonly baseUrl: string
  readonly model: string
  readonly path: string
}

const PROVIDER_DEFAULTS = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-4-5-20251001',
    path: '/messages',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-6-luna',
    path: '/chat/completions',
  },
  opencode: {
    baseUrl: 'https://opencode.ai/zen/v1',
    model: 'glm-5.3-flash',
    path: '/chat/completions',
  },
} satisfies Record<LlmProvider, ProviderDefaults>

const PROVIDER_ORDER: readonly LlmProvider[] = ['anthropic', 'openai', 'opencode']

/** Normalizes aliases so `openai-compatible` or `zen` are accepted too. */
function parseProvider(raw: string): LlmProvider | null {
  switch (raw.trim().toLowerCase()) {
    case 'anthropic':
    case 'claude':
      return 'anthropic'
    case 'openai':
    case 'openai-compatible':
    case 'compatible':
      return 'openai'
    case 'opencode':
    case 'opencode-zen':
    case 'opencode_zen':
    case 'zen':
      return 'opencode'
    default:
      return null
  }
}

/** Infers a provider from a custom base URL when it is unambiguous. */
function providerFromBaseUrl(baseUrl: string): LlmProvider | null {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase()
    if (host === 'opencode.ai' || host.endsWith('.opencode.ai')) return 'opencode'
    if (host === 'anthropic.com' || host.endsWith('.anthropic.com')) return 'anthropic'
  } catch {
    return null
  }
  return null
}

function trim(value: string | undefined): string {
  return (value ?? '').trim()
}

/** Validates the resolved endpoint so a mistyped env value cannot become a
 * non-HTTP request. The URL is build-time config, never runtime user input. */
function resolveEndpoint(baseUrl: string, path: string): string | null {
  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

    const trimmedPath = url.pathname.replace(/\/+$/, '')
    url.pathname = trimmedPath.endsWith(path) ? trimmedPath : `${trimmedPath}${path}`
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Resolves the LLM configuration from the environment.
 *
 * Returns `null` when no key is configured (the NLQ panel then stays fully
 * offline) or when an explicit provider has no matching key.
 */
export function resolveLlmConfig(env: LlmEnv): LlmConfig | null {
  const genericKey = trim(env.VITE_LLM_API_KEY)
  const baseUrl = trim(env.VITE_LLM_BASE_URL)
  const explicitProvider = parseProvider(trim(env.VITE_LLM_PROVIDER))

  const providerKeys = {
    anthropic: trim(env.VITE_ANTHROPIC_API_KEY),
    openai: trim(env.VITE_OPENAI_API_KEY),
    opencode: trim(env.VITE_OPENCODE_API_KEY),
  } satisfies Record<LlmProvider, string>

  const providerModels = {
    anthropic: trim(env.VITE_ANTHROPIC_MODEL),
    openai: trim(env.VITE_OPENAI_MODEL),
    opencode: trim(env.VITE_OPENCODE_MODEL),
  } satisfies Record<LlmProvider, string>

  let provider: LlmProvider | null = explicitProvider
  if (!provider) {
    if (genericKey) {
      // A generic key alone is ambiguous (OpenAI and OpenCode both issue
      // `sk-` keys), so only unambiguous signals choose the provider.
      provider =
        providerFromBaseUrl(baseUrl) ?? (genericKey.startsWith('sk-ant-') ? 'anthropic' : null)
      provider ??= 'openai'
    } else {
      // A single provider-specific key is enough to select its provider.
      provider = PROVIDER_ORDER.find((candidate) => providerKeys[candidate].length > 0) ?? null
    }
  }
  if (!provider) return null

  const apiKey = genericKey || providerKeys[provider]
  if (!apiKey) return null

  const defaults = PROVIDER_DEFAULTS[provider]
  const model = trim(env.VITE_LLM_MODEL) || providerModels[provider] || defaults.model
  const url = resolveEndpoint(baseUrl || defaults.baseUrl, defaults.path)
  if (!url) return null

  return {
    provider,
    apiKey,
    model,
    url,
  }
}

/** Resolved at module load — Vite inlines these values at build time. */
export const llmConfig: LlmConfig | null = resolveLlmConfig(import.meta.env)
export const hasLlmConfig: boolean = llmConfig !== null
