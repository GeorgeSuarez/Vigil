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
  it('renders the title and tech subtitle', () => {
    setup(false)
    expect(screen.getByText('City Explorer')).toBeVisible()
    expect(screen.getByText(/ArcGIS Maps SDK/)).toBeVisible()
  })

  it('shows an API-key hint chip when no key is configured', () => {
    setup(false)
    expect(screen.getByText(/Add API key/)).toBeVisible()
  })

  it('hides the hint chip when a key is configured', () => {
    setup(true)
    expect(screen.queryByText(/Add API key/)).toBeNull()
    expect(screen.getByText('API key configured')).toBeVisible()
  })

  it('renders one calcite-option per basemap', () => {
    const { container } = setup(false)
    expect(container.querySelectorAll('calcite-option').length).toBe(BASEMAP_OPTIONS.length)
  })
})
