import { useCallback, useState } from 'react'
import type { LayerDescriptor } from '../lib/layers'

export type LayerVisibility = Record<string, boolean>

/**
 * Pure state logic for layer visibility, extracted from the UI so it can be
 * tested without web components or the ArcGIS SDK.
 */
export function useLayerVisibility(
  descriptors: readonly LayerDescriptor[],
): [LayerVisibility, (id: string, visible: boolean) => void] {
  const [visibility, setVisibility] = useState<LayerVisibility>(() =>
    Object.fromEntries(descriptors.map((d) => [d.id, d.defaultVisible])),
  )

  const toggle = useCallback((id: string, visible: boolean) => {
    setVisibility((prev) => ({ ...prev, [id]: visible }))
  }, [])

  return [visibility, toggle]
}
