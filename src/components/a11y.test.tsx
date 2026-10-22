import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { MapAnnouncer } from './MapAnnouncer'
import { NlqPanel } from './NlqPanel'
import { Header } from './Header'
import { LayerPanel } from './LayerPanel'
import { StatusBar } from './StatusBar'
import { VigilStat } from './VigilStat'
import type { ViewStatus } from '../lib/createMapController'
import { BASEMAP_OPTIONS } from '../lib/basemaps'
import { LAYER_DESCRIPTORS } from '../lib/layers'

/** Runs axe on the rendered markup and asserts an empty violations list. */
async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await axe(container)
  expect(results.violations).toEqual([])
}

describe('component accessibility (axe)', () => {
  it('header, layer panel, status bar, and announcer have no violations', async () => {
    const status: ViewStatus = { zoom: 4, scale: 2_340_000, lat: 37.4, lon: -122.1 }
    const { container } = render(
      <div>
        <Header
          hasApiKey={false}
          basemap="osm"
          basemapOptions={BASEMAP_OPTIONS}
          onBasemapChange={vi.fn()}
        />
        <LayerPanel layers={LAYER_DESCRIPTORS} visibility={{}} onToggle={vi.fn()} />
        <StatusBar
          status={status}
          extentItems={[{ label: 'quakes', count: 12 }]}
          timeStripOpen
          onToggleTimeStrip={vi.fn()}
        />
        {/* Target of the toggle's aria-controls. */}
        <div id="time-strip" />
        <MapAnnouncer message="Map centered 37.4° N, 122.1° W, zoom 4." />
      </div>,
    )
    await expectNoAxeViolations(container as HTMLElement)
  })

  it('the NLQ panel has no violations', async () => {
    const { container } = render(<NlqPanel onRun={vi.fn()} llmActive={false} hasApiKey={false} />)
    await expectNoAxeViolations(container as HTMLElement)
  })

  it('the stat element has no violations', async () => {
    const { container } = render(
      <div>
        <VigilStat label="Zoom" value={4} emphasis />
        <VigilStat label="Exposure" value="12,400" tone="danger" />
      </div>,
    )
    await expectNoAxeViolations(container as HTMLElement)
  })
})
