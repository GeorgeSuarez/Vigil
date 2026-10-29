/**
 * Screen-reader announcer for map state changes. The map is a canvas, so
 * visual state (extent, counts) is invisible to assistive tech — this live
 * region narrates it instead.
 */
export interface MapAnnouncerProps {
  message: string | null
}

export function MapAnnouncer({ message }: MapAnnouncerProps) {
  // `<output>` carries the implicit `status` role, so the element is the
  // semantics and no role attribute is needed. `aria-live` stays explicit: the
  // implicit value comes from that role mapping, and this must not be silent.
  return (
    <output aria-live="polite" className="sr-only">
      {message}
    </output>
  )
}
