import type { BasemapOption } from '../lib/basemaps'

export interface HeaderProps {
  hasApiKey: boolean
  basemap: string
  basemapOptions: readonly BasemapOption[]
  onBasemapChange: (value: string) => void
}

/** App header: brand, basemap switcher, and (when set) the API-key status chip.
 * The keyless call-to-action lives in the Ask-the-map panel, where the missing
 * key actually blocks something the user is trying to do. */
export function Header({ hasApiKey, basemap, basemapOptions, onBasemapChange }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <ellipse
            cx="16"
            cy="16"
            rx="4.2"
            ry="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M7 16h18" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <div className="brand-text">
          <h1>Vigil</h1>
        </div>
      </div>

      <div className="header-controls">
        <calcite-select
          label="Basemap"
          scale="s"
          oncalciteSelectChange={(e) => onBasemapChange(e.currentTarget.value)}
        >
          {basemapOptions.map((option) => (
            <calcite-option
              key={option.value}
              value={option.value}
              label={option.label}
              selected={option.value === basemap}
            >
              {option.label}
            </calcite-option>
          ))}
        </calcite-select>

        {hasApiKey && (
          <calcite-chip scale="s" kind="brand" icon="key" label="API key configured">
            API key configured
          </calcite-chip>
        )}
      </div>
    </header>
  )
}
