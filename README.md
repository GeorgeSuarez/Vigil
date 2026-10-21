# Vigil

A live natural-hazard watcher built with the **ArcGIS Maps SDK for JavaScript**, **React 19**, **TypeScript (strict)**, and the **Calcite Design System** — the stack Esri's own product teams use.

## Features

- 🗺️ **ArcGIS Maps SDK for JavaScript 5.x** via tree-shakeable ES module imports (`@arcgis/core`)
- 🧩 **Calcite Design System** web components (`calcite-switch`, `calcite-select`, `calcite-chip`) used natively from React 19
- 📡 **Live USGS earthquake feed** — the past 7 days worldwide as a `GeoJSONLayer`: clustered when dense, coloured by a magnitude class-break ramp, auto-refreshing every 2 minutes, with popup links to USGS event pages; plus a static Atlantic-hurricanes sample layer. Both keyless, with custom popup templates
- 🔥 **NASA EONET natural events** — open wildfires, severe storms, and sea-and-lake ice from the last 30 days. Each category gets its own **inline vector glyph** (flame, cyclone, snowflake, volcano cone) plus a colour, so the map stays readable without relying on hue alone. Keyless.
- 🛰️ **Live ISS position** — the space station's real-time spot, polled every 5 s from wheretheiss.at and driven through a self-cleaning `GraphicsLayer` with an altitude/velocity popup. A target button on the layer row flies the map to it (the marker can be anywhere on the globe, so enabling the layer alone is not enough to find it). Keyless.
- 🔎 Search (geocoding) widget enabled when an API key is configured
- 📊 Live status bar — map center, zoom, scale — driven by SDK `watch` handlers
- 🌓 Dark, glassy UI with the SDK's dark theme and Calcite dark mode
- ♻️ View lifecycle done right: created once on mount, destroyed on unmount (StrictMode-safe)
- 🔗 **Shareable deep links** — basemap, extent, and layer visibility mirror into the URL hash and restore on load (`#b=topo&c=-122.4194,37.7749&z=12&l=earthquakes,hurricanes`)
- 🔢 **Live view-extent stats** — per-layer feature counts in the status bar, recomputed via `queryFeatureCount` whenever the map stops moving or a layer toggles
- ⏱️ **Time slider** — dual-thumb temporal filter over the quakes layer (SDK `TimeSlider` + `layer.timeInfo`); the map and the in-view counts both react to the active window. The range is derived from the layer's own time extent at load, not hardcoded.
- ♿ **Accessibility** — landmarks with accessible names, a screen-reader announcer (ARIA live region) narrating settled map state, visible focus states, and `prefers-reduced-motion` support; every SDK-free component passes an axe audit in the unit suite.
- 💬 **Ask the map** — natural-language commands ("M5 in Alaska", "last 3 days", "zoom to Japan", "clear filters") drive real map operations: layer definition expressions, animated fly-to, and the temporal window. Runs keyless via a pure offline parser; configure `VITE_ANTHROPIC_API_KEY` to route through Claude tool-calls instead.

## Quick start

```bash
pnpm install
pnpm dev
```

Requires Node 20+ and pnpm (the exact version is pinned by `packageManager` in `package.json`).

Open http://localhost:5173. The app runs **without any API key** — it uses the OpenStreetMap basemap and Esri's public sample services.

### Optional: ArcGIS API key

1. Create a free [ArcGIS Location Platform](https://locationplatform.arcgis.com/) developer account.
2. Copy `.env.example` to `.env.local` and paste your key:

   ```env
   VITE_ARCGIS_API_KEY=YOUR_KEY
   ```

3. Restart the dev server. You now get Esri vector basemaps plus the Search widget.

### Optional: Anthropic key for "Ask the map"

`.env.example` documents the NLQ keys too. Leave `VITE_ANTHROPIC_API_KEY` empty and the panel uses the offline rule-based parser with no network calls; set it to route commands through Claude tool-calls. `VITE_ANTHROPIC_MODEL` overrides the default model (`claude-haiku-4-5-20251001`).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | Typecheck + production build |
| `pnpm preview` | Serve the production build |
| `pnpm test` | Vitest (run once) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm typecheck` | `tsc -b` |
| `pnpm lint` | oxlint |
| `pnpm format` | oxfmt write |
| `pnpm format:check` | oxfmt check (no writes) |

## Architecture

```text
src/
├── App.tsx            # wires state, URL hash, and the non-map panels
├── main.tsx           # React root
├── index.css          # dark glassy theme and layout
├── test-setup.ts      # jest-dom matchers, RTL cleanup, jsdom polyfills
├── components/        # Presentational React components (arcgis-free except MapContainer)
│   ├── Header.tsx     #   brand, basemap switcher, API-key status chip
│   ├── LayerPanel.tsx #   floating panel with per-layer toggles + ISS locate action
│   ├── MapAnnouncer.tsx # ARIA live region narrating settled map state
│   ├── MapContainer.tsx # owns the MapView lifecycle; syncs props imperatively
│   ├── NlqPanel.tsx   #   "Ask the map" command panel
│   └── StatusBar.tsx  #   live center/zoom/scale readout + in-view counts
├── hooks/
│   ├── useLayerVisibility.ts    # pure toggle state logic
│   ├── useNlqRunner.ts          # NLQ executor lifecycle (offline parser or Claude)
│   ├── useSettledAnnouncement.ts # debounced screen-reader narration
│   └── useUrlMapState.ts        # URL-hash persistence
├── lib/
│   ├── arcgis.ts      # env config (API keys), esriConfig wiring
│   ├── basemaps.ts    # basemap option data
│   ├── createMapController.ts # SDK factory: Map, MapView, widgets, watchers
│   ├── eonet.ts       # NASA EONET fetch + property flattening
│   ├── format.ts      # pure formatting helpers
│   ├── icons.ts       # inline SVG glyph paths for EONET categories and ISS
│   ├── layers.ts      # layer descriptors, popup HTML, renderers, ISS polling
│   ├── urlState.ts    # shareable URL-hash parsing and serialisation
│   └── nlq/
│       ├── execute.ts # intent → map operations
│       ├── llm.ts     # optional Claude tool-call path
│       └── parser.ts  # offline rule-based parser + region table
└── types/calcite.d.ts # Calcite web components in React's JSX type space
```

**Data flow:** React state (`basemap`, layer visibility) → imperative updates on the live `MapView` (`map.basemap = …`, `layer.visible = …`). The view is created exactly once per mount; props never recreate it. SDK events (`reactiveUtils.watch`) flow back into React state through a stable, rAF-throttled callback.

**Why this split:** everything that imports `@arcgis/core` is isolated to `lib/`, `MapContainer`, and the one network-backed integration test. UI components are framework-agnostic and unit-testable without the SDK, which is the same separation Esri's React integration guides recommend.

## Testing

- **Vitest + jsdom + React Testing Library**
- Pure logic (formatters, popup HTML builders, URL-hash codec, EONET flattening, NLQ parser, visibility hook) has direct unit coverage
- Component tests render the real Calcite custom elements in jsdom and assert rendered attributes; `a11y.test.tsx` runs an axe audit over every SDK-free component
- `usgs-filter.test.ts` is a **network-backed integration test**: it loads the real USGS feed through the SDK's `GeoJSONLayer` to pin exactly when `definitionExpression` is honoured, including the case where an argued query bypasses it. It needs internet access and fails offline.
- `MapView` itself is exercised in the browser: `createMapController` has no jsdom test, so view rendering, widget layout and fly-to are verified manually

## Known follow-ups

- **Widget → component migration.** `Home`, `Legend`, `ScaleBar` and `TimeSlider` are
  deprecated in SDK 5.x in favour of `<arcgis-*>` web components. They still work
  and log one informational line each. Migrating them requires adopting
  `<arcgis-map>` (the components need that parent for layout and theming), which
  touches the view lifecycle, the time slider and the NLQ executor.
  Tracked in [#1](https://github.com/GeorgeSuarez/arcgis-vigil/issues/1).

## Learn more

- [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/)
- [Calcite Design System](https://developers.arcgis.com/calcite-design-system/)
- [React 19 custom elements](https://react.dev/reference/react-dom/components#custom-elements)
