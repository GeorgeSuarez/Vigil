import { useCallback, useEffect, useRef } from 'react'
import { anthropicApiKey, anthropicModel, hasAnthropicKey } from '../lib/arcgis'
import type { CityView } from '../lib/createCityView'
import { createNlqExecutor } from '../lib/nlq/execute'
import { intentFromLlm } from '../lib/nlq/llm'
import { parseNlQuery } from '../lib/nlq/parser'

/**
 * Runs one natural-language command. The optional LLM path (when
 * VITE_ANTHROPIC_API_KEY is configured) produces intents; any LLM failure
 * falls back to the offline rule-based parser. The executor is memoized for
 * the session so filter state survives across commands.
 */
export function useNlqRunner(getTargets: () => CityView | null): (text: string) => Promise<string> {
  const executorRef = useRef<ReturnType<typeof createNlqExecutor> | null>(null)

  // Latest-ref: targets are resolved at call time, so the returned callback
  // can keep a stable identity while always reading the current map.
  const targetsRef = useRef(getTargets)
  useEffect(() => {
    targetsRef.current = getTargets
  }, [getTargets])

  return useCallback(async (text: string): Promise<string> => {
    executorRef.current ??= createNlqExecutor(() => {
      const city = targetsRef.current()
      if (!city) return null
      return {
        view: city.view,
        layers: city.layers,
        timeSlider: city.timeSlider,
        refreshExtentStats: city.refreshExtentStats,
        applyQuakeFilter: city.applyQuakeFilter,
      }
    })
    const executor = executorRef.current
    // null (no key configured, or the LLM call failed) means: offline parser.
    const intents = hasAnthropicKey
      ? await intentFromLlm(text, anthropicApiKey, anthropicModel)
      : null
    return executor(intents ?? parseNlQuery(text))
  }, [])
}
