import { Fragment } from 'react'
import type { ViewStatus } from '../lib/createMapController'
import { formatDegrees, formatNumber, formatScale, withCountLabel } from '../lib/format'
import { VigilStat } from './VigilStat'

/** One per visible layer: a compact label plus its in-view feature count. */
export interface ExtentItem {
  label: string
  count: number
}

export interface StatusBarProps {
  status: ViewStatus
  extentItems: readonly ExtentItem[]
  /** Reflects the time slider strip's state; the toggle is omitted when the
   * handler is not wired (keeps the component drop-in for other hosts). */
  timeStripOpen?: boolean
  onToggleTimeStrip?: () => void
}

/** Bottom strip mirroring the live view state (center, zoom, scale, counts). */
export function StatusBar({
  status,
  extentItems,
  timeStripOpen,
  onToggleTimeStrip,
}: StatusBarProps) {
  return (
    <footer className="status-bar" aria-label="Map view status">
      {/* Focusable because it scrolls: on a phone the row overflows, and a
          scroll container whose content is plain text is unreachable by
          keyboard without its own tab stop — a documented WAI exception that
          both jsx-a11y heuristics below object to. The `group` role exists so
          the tab stop has a name to announce (ARIA forbids naming a bare div). */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex, jsx-a11y/prefer-tag-over-role */}
      <div className="status-items" role="group" aria-label="Map state" tabIndex={0}>
        <VigilStat
          label="Center"
          emphasis
          value={`${formatDegrees(status.lat, 'lat')}, ${formatDegrees(status.lon, 'lon')}`}
        />
        <VigilStat
          label="Zoom"
          emphasis
          value={status.zoom === null ? '—' : Math.round(status.zoom)}
        />
        <VigilStat label="Scale" emphasis value={formatScale(status.scale)} />
        {extentItems.length > 0 && (
          <VigilStat
            label="In view"
            emphasis
            value={extentItems.map((item, index) => (
              <Fragment key={item.label}>
                {index > 0 && ' · '}
                {formatNumber(item.count)} {withCountLabel(item.count, item.label)}
              </Fragment>
            ))}
          />
        )}
      </div>
      {onToggleTimeStrip !== undefined && (
        <button
          type="button"
          className="time-toggle"
          onClick={onToggleTimeStrip}
          aria-expanded={timeStripOpen}
          aria-controls="time-strip"
          aria-label={timeStripOpen ? 'Hide the time slider' : 'Show the time slider'}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
            <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M8 4.75V8l2.25 1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </footer>
  )
}
