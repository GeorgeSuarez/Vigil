import { fireEvent, render, screen } from '@testing-library/react'
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
    const { container } = setup({ earthquakes: true, nhc: false })
    const checked = container.querySelector(
      'calcite-switch[data-testid="layer-earthquakes"][checked]',
    )
    const unchecked = container.querySelector(
      'calcite-switch[data-testid="layer-nhc"]:not([checked])',
    )
    expect(checked).not.toBeNull()
    expect(unchecked).not.toBeNull()
  })
})

describe('LayerPanel ISS locate action', () => {
  const locate = (props: { issLocatable?: boolean } = {}) =>
    render(
      <LayerPanel
        layers={LAYER_DESCRIPTORS}
        visibility={{}}
        onToggle={vi.fn()}
        onLocateIss={vi.fn()}
        {...props}
      />,
    )

  it('omits the action when no handler is wired', () => {
    setup({})
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('disables the action until a position has arrived', () => {
    locate({ issLocatable: false })
    expect(screen.getByRole('button', { name: /live ISS position/i })).toBeDisabled()
  })

  it('fires the handler once a position is available', () => {
    const onLocateIss = vi.fn()
    render(
      <LayerPanel
        layers={LAYER_DESCRIPTORS}
        visibility={{}}
        onToggle={vi.fn()}
        onLocateIss={onLocateIss}
        issLocatable
      />,
    )
    const button = screen.getByRole('button', { name: /live ISS position/i })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(onLocateIss).toHaveBeenCalledTimes(1)
  })
})
