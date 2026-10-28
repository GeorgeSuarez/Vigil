import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NlqPanel } from './NlqPanel'

const open = (props: { llmActive?: boolean } = {}): void => {
  render(<NlqPanel onRun={vi.fn()} llmActive={props.llmActive ?? false} />)
  fireEvent.click(screen.getByRole('button', { name: /open the ask-the-map panel/i }))
}

describe('NlqPanel', () => {
  it('starts as a pill and opens the card on click', () => {
    render(<NlqPanel onRun={vi.fn()} llmActive={false} />)

    expect(screen.queryByRole('region', { name: 'Ask the map' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /open the ask-the-map panel/i }))

    expect(screen.getByRole('region', { name: 'Ask the map' })).toBeVisible()
    expect(screen.getByText('offline rules')).toBeVisible()
  })

  it('labels the mode when the LLM path is configured', () => {
    open({ llmActive: true })

    expect(screen.getByText('LLM')).toBeVisible()
    expect(screen.queryByText('offline rules')).toBeNull()
  })

  it('keeps the card to the log and the input', () => {
    open()

    const card = screen.getByRole('region', { name: 'Ask the map' })
    expect(card.querySelector('[role="log"]')).toBeInTheDocument()
    expect(card.querySelector('form')).toBeInTheDocument()
    // Rendered copy is limited to the prompt hint, not configuration advice.
    expect(card.textContent).not.toContain('VITE_')
  })
})
