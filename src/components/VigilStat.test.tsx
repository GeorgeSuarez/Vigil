import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VigilStat } from './VigilStat'

describe('VigilStat', () => {
  it('renders label and value as light-DOM text', () => {
    render(<VigilStat label="Zoom" value={4} />)

    expect(screen.getByText('Zoom')).toBeVisible()
    expect(screen.getByText('4')).toBeVisible()
  })

  it('passes tone and emphasis through as reflected attributes', () => {
    const { container } = render(
      <VigilStat label="Exposure" value="12,400" tone="danger" emphasis />,
    )
    const host = container.querySelector('vigil-stat')

    // React assigned the properties; the element reflected them for CSS.
    expect(host?.getAttribute('tone')).toBe('danger')
    expect(host?.hasAttribute('emphasis')).toBe(true)
  })

  it('defaults to the neutral tone without emphasis', () => {
    const { container } = render(<VigilStat label="Zoom" value={4} />)
    const host = container.querySelector('vigil-stat')

    expect(host?.getAttribute('tone')).toBe('neutral')
    expect(host?.hasAttribute('emphasis')).toBe(false)
  })

  it('renders rich values without losing the label', () => {
    render(
      <VigilStat
        label="In view"
        value={
          <>
            <strong>412</strong> quakes
          </>
        }
      />,
    )

    expect(screen.getByText('In view')).toBeVisible()
    expect(screen.getByText('412')).toBeVisible()
    expect(screen.getByText(/quakes/)).toBeVisible()
  })
})
