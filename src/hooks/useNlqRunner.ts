import { useCallback, useEffect, useRef } from 'react'
import type { MapController } from '../lib/createMapController'
import { createNlqExecutor } from '../lib/nlq/execute'
import { intentFromLlm } from '../lib/nlq/llm'
import { llmConfig } from '../lib/nlq/llmConfig'
import { parseNlQuery } from '../lib/nlq/parser'

/**
 * Runs one natural-language command. The optional LLM path (when
 * `VITE_LLM_*` or a provider-specific key is configured) produces intents;
 * any LLM failure falls back to the offline rule-based parser. The executor
 * is memoized for the session so filter state survives across commands.
 */
export function useNlqRunner(
  getTargets: () => MapController | null,
): (text: string) => Promise<string> {
  const executorRef = useRef<ReturnType<typeof createNlqExecutor> | null>(null)

  // Latest-ref: targets are resolved at call time, so the returned callback
  // can keep a stable identity while always reading the current map.
  const targetsRef = useRef(getTargets)
  useEffect(() => {
    targetsRef.current = getTargets
  }, [getTargets])

  return useCallback(async (text: string): Promise<string> => {
    executorRef.current ??= createNlqExecutor(() => {
      const controller = targetsRef.current()
      if (!controller) return null
      return {
        view: controller.view,
        layers: controller.layers,
        timeSlider: controller.timeSlider,
        refreshExtentStats: controller.refreshExtentStats,
        applyQuakeFilter: controller.applyQuakeFilter,
      }
    })
    const executor = executorRef.current
    // null (no key configured, or the LLM call failed) means: offline parser.
    const intents = llmConfig ? await intentFromLlm(text, llmConfig) : null
    return executor(intents ?? parseNlQuery(text))
  }, [])
}
