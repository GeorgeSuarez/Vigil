/**
 * Screen-reader announcer for map state changes. The map is a canvas, so
 * visual state (extent, counts) is invisible to assistive tech — this live
 * region narrates it instead.
 */
export interface MapAnnouncerProps {
  message: string | null
}

export function MapAnnouncer({ message }: MapAnnouncerProps) {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}
