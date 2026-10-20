import { useEffect, useRef, useState } from 'react'
import type { ExtentStats, ViewStatus } from '../lib/createCityView'
import { formatDegrees } from '../lib/format'
import { LAYER_DESCRIPTORS } from '../lib/layers'

const ANNOUNCE_DELAY_MS = 600

/**
 * Narrates settled map state for screen readers: returns a string 600ms
 * after the last change (extent stats only update on stationary/toggle/time
 * changes, which doubles as the "map stopped moving" signal).
 */
export function useSettledAnnouncement(
  status: ViewStatus,
  extentStats: ExtentStats,
): string | null {
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const announceTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const { zoom, lat, lon } = status
    if (zoom === null || lat === null || lon === null) return
    window.clearTimeout(announceTimer.current)
    announceTimer.current = window.setTimeout(() => {
      const items = LAYER_DESCRIPTORS.flatMap((layer) =>
        layer.id in extentStats ? [`${extentStats[layer.id]} ${layer.shortTitle}`] : [],
      )
      const counts = items.length > 0 ? ` ${items.join(', ')} in view.` : ''
      setAnnouncement(
        `Map centered ${formatDegrees(lat, 'lat')}, ${formatDegrees(lon, 'lon')}, zoom ${Math.round(zoom)}.${counts}`,
      )
    }, ANNOUNCE_DELAY_MS)
  }, [status, extentStats])

  useEffect(() => () => window.clearTimeout(announceTimer.current), [])

  return announcement
}
