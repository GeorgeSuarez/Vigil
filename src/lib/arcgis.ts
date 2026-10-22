import esriConfig from '@arcgis/core/config'

/**
 * ArcGIS Location Platform API key, read from the environment.
 *
 * Optional: without a key the app falls back to the keyless OpenStreetMap
 * basemap and the public sample services in `layers.ts`. With a key you get
 * Esri vector basemaps, the Search (geocoding) widget, and premium content.
 */
export const apiKey: string = (import.meta.env.VITE_ARCGIS_API_KEY ?? '').trim()

export const hasApiKey: boolean = apiKey.length > 0

/** Applies the API key (when present) to the SDK. Called when the map is created. */
export function configureArcgisSdk(key: string): void {
  if (key) esriConfig.apiKey = key
}
