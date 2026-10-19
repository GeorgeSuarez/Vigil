/** Basemap choices surfaced in the header. Values are ArcGIS basemap style ids. */
export interface BasemapOption {
  value: string
  label: string
}

export const BASEMAP_OPTIONS: readonly BasemapOption[] = [
  { value: 'osm', label: 'OpenStreetMap' },
  { value: 'topo', label: 'Topographic' },
  { value: 'satellite', label: 'Imagery' },
  { value: 'dark-gray', label: 'Dark Gray Canvas' },
] as const
