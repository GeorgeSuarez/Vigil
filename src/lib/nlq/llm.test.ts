import { afterEach, describe, expect, it, vi } from 'vitest'
import { intentFromLlm } from './llm'
import type { LlmConfig } from './llmConfig'

const openAiConfig: LlmConfig = {
  provider: 'openai',
  apiKey: 'sk-test',
  model: 'gpt-6-luna',
  url: 'https://api.openai.com/v1/chat/completions',
}

const anthropicConfig: LlmConfig = {
  provider: 'anthropic',
  apiKey: 'sk-ant-test',
  model: 'claude-haiku-4-5-20251001',
  url: 'https://api.anthropic.com/v1/messages',
}

function mockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 401,
    json: async () => body,
  } as Response
}

function stubFetch(body: unknown, ok = true): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(mockResponse(body, ok))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return { url, init }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('intentFromLlm (OpenAI-compatible)', () => {
  it('maps tool calls to intents and sends the OpenAI tool schema', async () => {
    const fetchMock = stubFetch({
      choices: [
        {
          message: {
            tool_calls: [
              { function: { name: 'filter_by_magnitude', arguments: '{"min":5}' } },
              { function: { name: 'filter_by_region', arguments: '{"region":"Alaska"}' } },
              { function: { name: 'set_time_window', arguments: '{"hours_ago":72}' } },
            ],
          },
        },
      ],
    })

    await expect(intentFromLlm('M5 in Alaska last 3 days', openAiConfig)).resolves.toEqual([
      { kind: 'filter-magnitude', min: 5 },
      { kind: 'filter-region', region: 'Alaska' },
      { kind: 'time-window', startHoursAgo: 72, endHoursAgo: 0 },
    ])

    const { url, init } = requestOf(fetchMock)
    expect(url).toBe(openAiConfig.url)
    expect(init.headers).toMatchObject({ authorization: 'Bearer sk-test' })

    const body = JSON.parse(String(init.body)) as {
      model: string
      messages: unknown[]
      tools: unknown[]
      tool_choice: string
    }
    expect(body.model).toBe('gpt-6-luna')
    expect(body.tool_choice).toBe('auto')
    expect(body.tools).toHaveLength(4)
    expect(body.messages).toEqual([
      { role: 'system', content: expect.any(String) },
      { role: 'user', content: 'M5 in Alaska last 3 days' },
    ])
  })

  it('treats empty arguments as an empty object for clear_filters', async () => {
    stubFetch({
      choices: [
        { message: { tool_calls: [{ function: { name: 'clear_filters', arguments: '' } }] } },
      ],
    })

    await expect(intentFromLlm('clear filters', openAiConfig)).resolves.toEqual([
      { kind: 'clear-filters' },
    ])
  })

  it('accepts the deprecated function_call shape', async () => {
    stubFetch({
      choices: [
        {
          message: {
            function_call: { name: 'filter_by_region', arguments: '{"region":"Japan"}' },
          },
        },
      ],
    })

    await expect(intentFromLlm('zoom to Japan', openAiConfig)).resolves.toEqual([
      { kind: 'filter-region', region: 'Japan' },
    ])
  })

  it('drops malformed tool arguments but keeps valid calls', async () => {
    stubFetch({
      choices: [
        {
          message: {
            tool_calls: [
              { function: { name: 'filter_by_region', arguments: '{not json}' } },
              { function: { name: 'filter_by_magnitude', arguments: '{"min":4.5}' } },
            ],
          },
        },
      ],
    })

    await expect(intentFromLlm('M4.5 in ???', openAiConfig)).resolves.toEqual([
      { kind: 'filter-magnitude', min: 4.5 },
    ])
  })

  it('returns null when the model replies with prose', async () => {
    stubFetch({ choices: [{ message: { content: 'I cannot help with that.' } }] })

    await expect(intentFromLlm('what is the weather?', openAiConfig)).resolves.toBeNull()
  })

  it('returns null on a non-OK response', async () => {
    stubFetch({ error: 'unauthorized' }, false)

    await expect(intentFromLlm('M5', openAiConfig)).resolves.toBeNull()
  })

  it('returns null when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(intentFromLlm('M5', openAiConfig)).resolves.toBeNull()
  })
})

describe('intentFromLlm (Anthropic)', () => {
  it('maps tool_use blocks to intents and sends the Anthropic tool schema', async () => {
    const fetchMock = stubFetch({
      content: [
        { type: 'text', text: 'Thinking…' },
        { type: 'tool_use', name: 'filter_by_magnitude', input: { min: 6 } },
        { type: 'tool_use', name: 'clear_filters', input: {} },
      ],
    })

    await expect(intentFromLlm('M6 then clear', anthropicConfig)).resolves.toEqual([
      { kind: 'filter-magnitude', min: 6 },
      { kind: 'clear-filters' },
    ])

    const { url, init } = requestOf(fetchMock)
    expect(url).toBe(anthropicConfig.url)
    expect(init.headers).toMatchObject({ 'x-api-key': 'sk-ant-test' })

    const body = JSON.parse(String(init.body)) as {
      tool_choice: unknown
      tools: { input_schema: unknown }[]
    }
    expect(body.tool_choice).toEqual({ type: 'any' })
    expect(body.tools[0]?.input_schema).toMatchObject({ type: 'object' })
  })
})
