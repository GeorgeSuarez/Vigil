interface ImportMetaEnv {
  readonly VITE_ARCGIS_API_KEY?: string

  /** Generic LLM config — works with every supported provider. */
  readonly VITE_LLM_PROVIDER?: string
  readonly VITE_LLM_API_KEY?: string
  readonly VITE_LLM_MODEL?: string
  readonly VITE_LLM_BASE_URL?: string

  /** Provider-specific aliases; setting one selects its provider. */
  readonly VITE_ANTHROPIC_API_KEY?: string
  readonly VITE_ANTHROPIC_MODEL?: string
  readonly VITE_OPENAI_API_KEY?: string
  readonly VITE_OPENAI_MODEL?: string
  readonly VITE_OPENCODE_API_KEY?: string
  readonly VITE_OPENCODE_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
