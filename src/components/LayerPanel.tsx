import type { LayerDescriptor } from '../lib/layers'

export interface LayerPanelProps {
  layers: readonly LayerDescriptor[]
  visibility: Record<string, boolean>
  onToggle: (id: string, visible: boolean) => void
  /** Flies the map to the live ISS position. Omit to hide the affordance. */
  onLocateIss?: () => void
  /** False until the first ISS position arrives (the button stays disabled). */
  issLocatable?: boolean
}

/** Floating panel with one toggle per dataset; state is owned by App. */
export function LayerPanel({
  layers,
  visibility,
  onToggle,
  onLocateIss,
  issLocatable = false,
}: LayerPanelProps) {
  return (
    <aside className="side-panel" aria-label="Layer controls">
      <h2 className="side-panel-title">Layers</h2>
      <p className="side-panel-hint">Toggles sync with the map in real time.</p>

      <ul className="layer-list">
        {layers.map((layer) => {
          const visible = visibility[layer.id] ?? layer.defaultVisible
          // The ISS marker can be anywhere on the globe, so its row carries a
          // locate action — without it the layer is easy to "enable" and never
          // actually see.
          const showLocate = layer.id === 'iss' && onLocateIss !== undefined
          return (
            <li key={layer.id} className="layer-row">
              <div className="layer-text">
                <span className="layer-title">{layer.title}</span>
                <span className="layer-desc">{layer.description}</span>
              </div>
              <div className="layer-actions">
                {showLocate && (
                  <button
                    type="button"
                    className="layer-locate"
                    onClick={onLocateIss}
                    disabled={!issLocatable}
                    aria-label="Center the map on the live ISS position"
                    title={
                      issLocatable ? 'Center on the ISS' : 'Waiting for the first ISS position…'
                    }
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width="16"
                      height="16"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="4.25"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
                <calcite-switch
                  data-testid={`layer-${layer.id}`}
                  checked={visible}
                  label={`Show ${layer.title}`}
                  oncalciteSwitchChange={(e) => onToggle(layer.id, e.currentTarget.checked)}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <p className="side-panel-foot">
        Data: live USGS earthquake feed, NASA EONET events, the live ISS position, and Esri sample
        services · popups, clustering, and the time slider are configured in code.
      </p>
    </aside>
  )
}
