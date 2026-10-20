import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBar } from './StatusBar'
import type { ViewStatus } from '../lib/createCityView'

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
})
