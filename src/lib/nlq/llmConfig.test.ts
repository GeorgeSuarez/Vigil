import { describe, expect, it } from 'vitest'
import { resolveLlmConfig } from './llmConfig'

describe('resolveLlmConfig', () => {
  it('stays offline with no key', () => {
    expect(resolveLlmConfig({})).toBeNull()
  })

  it('keeps the legacy Anthropic key working', () => {
    expect(resolveLlmConfig({ VITE_ANTHROPIC_API_KEY: 'sk-ant-legacy' })).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-ant-legacy',
      model: 'claude-haiku-4-5-20251001',
      url: 'https://api.anthropic.com/v1/messages',
    })
  })

  it('infers Anthropic from a generic key prefix', () => {
    const config = resolveLlmConfig({ VITE_LLM_API_KEY: ' sk-ant-test ' })
    expect(config?.provider).toBe('anthropic')
    expect(config?.apiKey).toBe('sk-ant-test')
  })

  it('defaults a generic key to OpenAI when it is unambiguous', () => {
    const config = resolveLlmConfig({ VITE_LLM_API_KEY: 'sk-test' })
    expect(config?.provider).toBe('openai')
    expect(config?.url).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('supports OpenAI and OpenCode through the generic provider key', () => {
    const openai = resolveLlmConfig({ VITE_LLM_PROVIDER: 'openai', VITE_LLM_API_KEY: 'sk-test' })
    expect(openai).toMatchObject({
      provider: 'openai',
      model: 'gpt-6-luna',
      url: 'https://api.openai.com/v1/chat/completions',
    })

    const opencode = resolveLlmConfig({
      VITE_LLM_PROVIDER: 'opencode',
      VITE_LLM_API_KEY: 'sk-test',
    })
    expect(opencode).toMatchObject({
      provider: 'opencode',
      model: 'glm-5.3-flash',
      url: 'https://opencode.ai/zen/v1/chat/completions',
    })
  })

  it('accepts provider aliases such as openai-compatible and zen', () => {
    expect(
      resolveLlmConfig({ VITE_LLM_PROVIDER: 'openai-compatible', VITE_LLM_API_KEY: 'sk-test' })
        ?.provider,
    ).toBe('openai')
    expect(
      resolveLlmConfig({ VITE_LLM_PROVIDER: 'zen', VITE_LLM_API_KEY: 'sk-test' })?.provider,
    ).toBe('opencode')
  })

  it('infers the provider from provider-specific key aliases', () => {
    expect(resolveLlmConfig({ VITE_OPENAI_API_KEY: 'sk-openai' })?.provider).toBe('openai')
    expect(resolveLlmConfig({ VITE_OPENCODE_API_KEY: 'sk-opencode' })?.provider).toBe('opencode')
    expect(resolveLlmConfig({ VITE_ANTHROPIC_API_KEY: 'sk-ant' })?.provider).toBe('anthropic')
  })

  it('prefers the generic key and model when both are supplied', () => {
    const config = resolveLlmConfig({
      VITE_LLM_PROVIDER: 'openai',
      VITE_LLM_API_KEY: 'sk-generic',
      VITE_LLM_MODEL: 'generic-model',
      VITE_OPENAI_API_KEY: 'sk-specific',
      VITE_OPENAI_MODEL: 'specific-model',
    })
    expect(config).toMatchObject({ apiKey: 'sk-generic', model: 'generic-model' })
  })

  it('uses provider-specific model overrides', () => {
    const config = resolveLlmConfig({
      VITE_OPENCODE_API_KEY: 'sk-opencode',
      VITE_OPENCODE_MODEL: 'kimi-k2.7-code',
    })
    expect(config?.model).toBe('kimi-k2.7-code')
  })

  it('uses a custom OpenAI-compatible base URL', () => {
    const config = resolveLlmConfig({
      VITE_LLM_PROVIDER: 'openai',
      VITE_LLM_API_KEY: 'sk-test',
      VITE_LLM_BASE_URL: 'https://gateway.example/v1/',
    })
    expect(config?.url).toBe('https://gateway.example/v1/chat/completions')
  })

  it('infers OpenCode from its base URL when the provider is omitted', () => {
    const config = resolveLlmConfig({
      VITE_LLM_API_KEY: 'sk-test',
      VITE_LLM_BASE_URL: 'https://opencode.ai/zen/v1',
    })
    expect(config?.provider).toBe('opencode')
    expect(config?.url).toBe('https://opencode.ai/zen/v1/chat/completions')
  })

  it('accepts a full endpoint URL without duplicating the path', () => {
    const config = resolveLlmConfig({
      VITE_LLM_PROVIDER: 'openai',
      VITE_LLM_API_KEY: 'sk-test',
      VITE_LLM_BASE_URL: 'https://gateway.example/v1/chat/completions',
    })
    expect(config?.url).toBe('https://gateway.example/v1/chat/completions')
  })

  it('preserves query parameters on a custom base URL', () => {
    const config = resolveLlmConfig({
      VITE_LLM_PROVIDER: 'openai',
      VITE_LLM_API_KEY: 'sk-test',
      VITE_LLM_BASE_URL: 'https://gateway.example/v1?api-version=2024-10-21',
    })
    expect(config?.url).toBe('https://gateway.example/v1/chat/completions?api-version=2024-10-21')
  })

  it('rejects a non-HTTP endpoint', () => {
    expect(
      resolveLlmConfig({
        VITE_LLM_PROVIDER: 'openai',
        VITE_LLM_API_KEY: 'sk-test',
        VITE_LLM_BASE_URL: 'javascript:alert(1)',
      }),
    ).toBeNull()
  })

  it('does not use a key that does not match an explicit provider', () => {
    expect(
      resolveLlmConfig({ VITE_LLM_PROVIDER: 'opencode', VITE_OPENAI_API_KEY: 'sk-openai' }),
    ).toBeNull()
  })
})
