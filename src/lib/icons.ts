/**
 * Inline vector glyphs for map markers.
 *
 * Design space is 32×32; a SimpleMarkerSymbol `path` is scaled to the symbol
 * size. The shapes are single-colour silhouettes with a dark outline: at the
 * ~18px a map marker gets, silhouette legibility beats internal detail, and the
 * fill comes from the layer's category colour so the legend stays consistent.
 *
 * Each glyph is ONE closed subpath drawn with M/L/C/Q/Z only. SimpleMarkerSymbol
 * renders only the first subpath of a compound path (verified in the browser: a
 * two-hook cyclone and a panel/body/panel satellite each lost every subpath
 * after the first), and it does not support SVG arc (A) commands at all — such
 * a path renders nothing.
 *
 * Why not Esri's WebStyleSymbol hazard icons? They resolve over the network and
 * cannot be resized or recoloured in 2D (fetchSymbol is 3D-only), which rules
 * them out for size control and offline rendering.
 */

export const ICON_PATHS = {
  /** Wildfires — flame with a notched left shoulder and an offset tip, so it
   * does not read as a water droplet. */
  wildfire:
    'M16 30 C10 30 6 25 7 19 C8 14 12 12 13 8 L15 12 ' +
    'C15.5 9 16 5 16 1 C20 7 25 11 25 18 C25 25 21 30 16 30 Z',
  /** Severe storms — a spiral ribbon. Draw only with C/L/Q/Z: simple-marker
   * paths do NOT support SVG arc (A) commands — they render nothing. */
  storm:
    'M16 4 C22.63 4 28 9.37 28 16 C28 22.63 22.63 28 16 28 C9.37 28 4 22.63 4 16 ' +
    'L10 16 C10 19.31 12.69 22 16 22 C19.31 22 22 19.31 22 16 C22 12.69 19.31 10 16 10 Z',
  /** Sea and lake ice — six-point flake. */
  ice:
    'M16 2 L18.5 11.7 L28.1 9 L21 16 L28.1 23 L18.5 20.3 L16 30 L13.5 20.3 L3.9 23 ' +
    'L11 16 L3.9 9 L13.5 11.7 Z',
  /** Volcanoes — cone with a crater dip. */
  volcano: 'M9 8 Q16 13 23 8 L29 27 L3 27 Z',
  /** ISS — solar panels joined to a taller body by a single silhouette. */
  satellite: 'M3 11 L13 11 L13 8 L19 8 L19 11 L29 11 L29 21 L19 21 L19 24 L13 24 L13 21 L3 21 Z',
} as const

export type IconName = keyof typeof ICON_PATHS

/** Marker size in points. Large enough for a glyph to read, small enough that
 * dense layers stay legible. */
export const ICON_SIZE = 18

/** Marker outline: dark so glyphs separate from light basemaps; the fill
 * carries contrast over dark basemaps. */
export const ICON_OUTLINE_COLOR = '#0b1220'
