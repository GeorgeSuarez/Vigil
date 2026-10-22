import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Header } from './Header'
import { BASEMAP_OPTIONS } from '../lib/basemaps'

const setup = (hasApiKey: boolean) =>
  render(
    <Header
      hasApiKey={hasApiKey}
      basemap="osm"
      basemapOptions={BASEMAP_OPTIONS}
      onBasemapChange={vi.fn()}
    />,
  )

describe('Header', () => {
  it('renders the title', () => {
    setup(false)
    expect(screen.getByText('Vigil')).toBeVisible()
    expect(screen.queryByText(/ArcGIS Maps SDK/)).toBeNull()
  })

  it('shows no key hint when no key is configured', () => {
    setup(false)
    // The call-to-action moved into the Ask-the-map panel; the header stays quiet.
    expect(screen.queryByText(/Add API key/)).toBeNull()
    expect(screen.queryByText(/API key configured/)).toBeNull()
  })

  it('confirms the key once one is configured', () => {
    setup(true)
    expect(screen.queryByText(/Add API key/)).toBeNull()
    expect(screen.getByText('API key configured')).toBeVisible()
  })

  it('renders one calcite-option per basemap', () => {
    const { container } = setup(false)
    expect(container.querySelectorAll('calcite-option').length).toBe(BASEMAP_OPTIONS.length)
  })
})
