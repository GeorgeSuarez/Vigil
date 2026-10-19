import type { LayerDescriptor } from '../lib/layers'

export interface LayerPanelProps {
  layers: readonly LayerDescriptor[]
  visibility: Record<string, boolean>
  onToggle: (id: string, visible: boolean) => void
}

/** Floating panel with one toggle per dataset; state is owned by App. */
export function LayerPanel({ layers, visibility, onToggle }: LayerPanelProps) {
  return (
    <aside className="side-panel" aria-label="Layer controls">
      <h2 className="side-panel-title">Layers</h2>
      <p className="side-panel-hint">Toggles sync with the map in real time.</p>

      <ul className="layer-list">
        {layers.map((layer) => {
          const visible = visibility[layer.id] ?? layer.defaultVisible
          return (
            <li key={layer.id} className="layer-row">
              <div className="layer-text">
                <span className="layer-title">{layer.title}</span>
                <span className="layer-desc">{layer.description}</span>
              </div>
              <calcite-switch
                data-testid={`layer-${layer.id}`}
                checked={visible}
                label={`Show ${layer.title}`}
                oncalciteSwitchChange={(e) => onToggle(layer.id, e.currentTarget.checked)}
              />
            </li>
          )
        })}
      </ul>

      <p className="side-panel-foot">
        Data: Esri public sample services · popups and clustering are configured in code.
      </p>
    </aside>
  )
}
