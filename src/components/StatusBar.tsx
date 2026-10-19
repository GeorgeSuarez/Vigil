import type { ViewStatus } from '../lib/createCityView'
import { formatDegrees, formatScale } from '../lib/format'

export interface StatusBarProps {
  status: ViewStatus
}

/** Bottom strip mirroring the live view state (center, zoom, scale). */
export function StatusBar({ status }: StatusBarProps) {
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
    </footer>
  )
}
