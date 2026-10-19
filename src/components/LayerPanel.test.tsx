import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LayerPanel } from './LayerPanel'
import { LAYER_DESCRIPTORS } from '../lib/layers'

const setup = (visibility: Record<string, boolean>) =>
  render(<LayerPanel layers={LAYER_DESCRIPTORS} visibility={visibility} onToggle={vi.fn()} />)

describe('LayerPanel', () => {
  it('renders every layer title and description', () => {
    setup({})
    for (const layer of LAYER_DESCRIPTORS) {
      expect(screen.getByText(layer.title)).toBeVisible()
      expect(screen.getByText(layer.description)).toBeVisible()
    }
  })

  it('marks switches as checked according to visibility state', () => {
    const { container } = setup({ earthquakes: true, hurricanes: false })
    const checked = container.querySelector(
      'calcite-switch[data-testid="layer-earthquakes"][checked]',
    )
    const unchecked = container.querySelector(
      'calcite-switch[data-testid="layer-hurricanes"]:not([checked])',
    )
    expect(checked).not.toBeNull()
    expect(unchecked).not.toBeNull()
  })
})
