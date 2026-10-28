import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLayerVisibility } from './useLayerVisibility'
import { LAYER_DESCRIPTORS } from '../lib/layers'

describe('useLayerVisibility', () => {
  it('defaults visibility from the descriptors', () => {
    const { result } = renderHook(() => useLayerVisibility(LAYER_DESCRIPTORS))
    const [visibility] = result.current
    expect(visibility).toEqual({
      earthquakes: true,
      nhc: false,
      storms: true,
      eonet: true,
      iss: true,
    })
  })

  it('uses initialVisibleIds over descriptor defaults when provided', () => {
    const { result } = renderHook(() => useLayerVisibility(LAYER_DESCRIPTORS, ['storms']))
    expect(result.current[0]).toEqual({
      earthquakes: false,
      nhc: false,
      storms: true,
      eonet: false,
      iss: false,
    })
  })

  it('toggles a layer', () => {
    const { result } = renderHook(() => useLayerVisibility(LAYER_DESCRIPTORS))
    act(() => result.current[1]('nhc', true))
    expect(result.current[0].nhc).toBe(true)

    act(() => result.current[1]('earthquakes', false))
    expect(result.current[0].earthquakes).toBe(false)
    expect(result.current[0].nhc).toBe(true)
  })
})
