import { useCallback, useState } from 'react'
import type { LayerDescriptor } from '../lib/layers'

export type LayerVisibility = Record<string, boolean>

/**
 * Pure state logic for layer visibility, extracted from the UI so it can be
 * tested without web components or the ArcGIS SDK.
 *
 * When `initialVisibleIds` is provided (e.g. restored from the URL hash),
 * visibility starts from that list instead of each layer's default.
 */
export function useLayerVisibility(
  descriptors: readonly LayerDescriptor[],
  initialVisibleIds?: readonly string[],
): [LayerVisibility, (id: string, visible: boolean) => void] {
  const [visibility, setVisibility] = useState<LayerVisibility>(() =>
    Object.fromEntries(
      descriptors.map((d) => [
        d.id,
        initialVisibleIds ? initialVisibleIds.includes(d.id) : d.defaultVisible,
      ]),
    ),
  )

  const toggle = useCallback((id: string, visible: boolean) => {
    setVisibility((prev) => ({ ...prev, [id]: visible }))
  }, [])

  return [visibility, toggle]
}
