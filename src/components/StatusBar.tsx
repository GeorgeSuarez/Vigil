import type { ViewStatus } from '../lib/createCityView'
import { formatDegrees, formatNumber, formatScale } from '../lib/format'

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
      <div className="status-items">
        <span className="status-item">
          Center{' '}
          <strong>
            {formatDegrees(status.lat, 'lat')}, {formatDegrees(status.lon, 'lon')}
          </strong>
        </span>
        <span className="status-item">
          Zoom <strong>{status.zoom === null ? '—' : Math.round(status.zoom)}</strong>
        </span>
        <span className="status-item">
          Scale <strong>{formatScale(status.scale)}</strong>
        </span>
        {extentItems.length > 0 && (
          <span className="status-item">
            In view{' '}
            {extentItems.map((item, index) => (
              <strong key={item.label}>
                {index > 0 && ' · '}
                {formatNumber(item.count)} {item.label}
              </strong>
            ))}
          </span>
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
