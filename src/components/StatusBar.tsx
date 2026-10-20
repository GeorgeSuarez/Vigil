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
}

/** Bottom strip mirroring the live view state (center, zoom, scale, counts). */
export function StatusBar({ status, extentItems }: StatusBarProps) {
  return (
    <footer className="status-bar" aria-label="Map view status">
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
    </footer>
  )
}
