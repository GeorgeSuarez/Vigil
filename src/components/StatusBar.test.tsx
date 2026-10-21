import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatusBar } from './StatusBar'
import type { ViewStatus } from '../lib/createMapController'

describe('StatusBar', () => {
  it('renders center, zoom, and scale', () => {
    const status: ViewStatus = {
      zoom: 4.2,
      scale: 2_340_000,
      lat: 37.4419,
      lon: -122.138,
    }
    render(<StatusBar status={status} extentItems={[]} />)
    expect(screen.getByText(/37.4419° N/)).toBeVisible()
    expect(screen.getByText(/122.1380° W/)).toBeVisible()
    expect(screen.getByText('Zoom')).toBeVisible()
    expect(screen.getByText('4')).toBeVisible()
    expect(screen.getByText('1 : 2.3M')).toBeVisible()
  })

  it('renders per-layer in-view counts', () => {
    const status: ViewStatus = { zoom: 4, scale: 1, lat: 0, lon: 0 }
    render(
      <StatusBar
        status={status}
        extentItems={[
          { label: 'quakes', count: 412 },
          { label: 'storms', count: 89 },
        ]}
      />,
    )
    expect(screen.getByText('In view')).toBeVisible()
    expect(screen.getByText(/412 quakes/)).toBeVisible()
    expect(screen.getByText(/· 89 storms/)).toBeVisible()
  })

  it('omits the counts section before the first query resolves', () => {
    const status: ViewStatus = { zoom: null, scale: null, lat: null, lon: null }
    render(<StatusBar status={status} extentItems={[]} />)
    expect(screen.getByText('—, —')).toBeVisible()
    expect(screen.getAllByText('—').length).toBe(2)
    expect(screen.queryByText('In view')).toBeNull()
  })

  it('omits the time-strip toggle when no handler is wired', () => {
    const status: ViewStatus = { zoom: 4, scale: 1, lat: 0, lon: 0 }
    render(<StatusBar status={status} extentItems={[]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('reflects the time-strip state and reports toggles', () => {
    const status: ViewStatus = { zoom: 4, scale: 1, lat: 0, lon: 0 }
    const onToggle = vi.fn()
    const { rerender } = render(
      <StatusBar status={status} extentItems={[]} timeStripOpen onToggleTimeStrip={onToggle} />,
    )
    const button = screen.getByRole('button', { name: 'Hide the time slider' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', 'time-strip')

    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)

    rerender(
      <StatusBar
        status={status}
        extentItems={[]}
        timeStripOpen={false}
        onToggleTimeStrip={onToggle}
      />,
    )
    expect(screen.getByRole('button', { name: 'Show the time slider' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})
