import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NlqPanel } from './NlqPanel'

const open = (props: { hasApiKey: boolean; llmActive?: boolean }): void => {
  render(
    <NlqPanel onRun={vi.fn()} llmActive={props.llmActive ?? false} hasApiKey={props.hasApiKey} />,
  )
  fireEvent.click(screen.getByRole('button', { name: /open the ask-the-map panel/i }))
}

describe('NlqPanel', () => {
  it('starts as a pill and opens the card on click', () => {
    render(<NlqPanel onRun={vi.fn()} llmActive={false} hasApiKey />)

    expect(screen.queryByRole('region', { name: 'Ask the map' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /open the ask-the-map panel/i }))

    expect(screen.getByRole('region', { name: 'Ask the map' })).toBeVisible()
    expect(screen.getByText('offline rules')).toBeVisible()
  })

  it('names the missing key when none is configured', () => {
    // The keyless call-to-action lives here now, not in the header: this is the
    // panel whose feature (LLM routing, and the map search it drives) needs one.
    open({ hasApiKey: false })

    expect(screen.getByText('No API key')).toBeVisible()
    expect(screen.getByText('VITE_ARCGIS_API_KEY')).toBeVisible()
    expect(screen.getByText('.env.example')).toBeVisible()
  })

  it('drops the hint once a key is configured', () => {
    open({ hasApiKey: true })

    expect(screen.queryByText('No API key')).toBeNull()
    expect(screen.queryByText(/VITE_ARCGIS_API_KEY/)).toBeNull()
  })

  it('keeps the hint out of the live log so it is not announced on open', () => {
    open({ hasApiKey: false })

    const log = screen.getByRole('log')
    expect(log.textContent).not.toContain('VITE_ARCGIS_API_KEY')
  })
})
