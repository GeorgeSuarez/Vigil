# City Explorer

A polished, deployable mapping app built with the **ArcGIS Maps SDK for JavaScript**, **React 19**, **TypeScript (strict)**, and the **Calcite Design System** — the stack Esri's own product teams use.

## Features

- 🗺️ **ArcGIS Maps SDK for JavaScript 5.x** via tree-shakeable ES module imports (`@arcgis/core`)
- 🧩 **Calcite Design System** web components (`calcite-switch`, `calcite-select`, `calcite-chip`) used natively from React 19
- 📡 **Live USGS earthquake feed** — the past 7 days worldwide as a `GeoJSONLayer`: clustered by magnitude, auto-refreshing every 2 min, with popup links to USGS event pages; plus a static Atlantic-hurricanes sample layer. Both keyless, with custom popup templates
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

Open http://localhost:5173. The app runs **without any API key** — it uses the OpenStreetMap basemap and Esri's public sample services.

### Optional: ArcGIS API key

1. Create a free [ArcGIS Location Platform](https://locationplatform.arcgis.com/) developer account.
2. Copy `.env.example` to `.env.local` and paste your key:

   ```env
   VITE_ARCGIS_API_KEY=YOUR_KEY
   ```

3. Restart the dev server. You now get Esri vector basemaps plus the Search widget.

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
├── components/        # Presentational React components (arcgis-free, testable)
│   ├── Header.tsx     #   brand, basemap switcher, API-key status chip
│   ├── LayerPanel.tsx #   floating panel with per-layer toggles
│   ├── StatusBar.tsx  #   live center/zoom/scale readout
│   └── MapContainer.tsx # owns the MapView lifecycle; syncs props imperatively
├── hooks/
│   └── useLayerVisibility.ts # pure toggle state logic
├── lib/
│   ├── arcgis.ts      # env config, API key, esriConfig wiring
│   ├── basemaps.ts    # basemap option data
│   ├── createCityView.ts # SDK factory: Map, MapView, widgets, watchers
│   ├── layers.ts      # layer descriptors, popup HTML builders, FeatureLayer factory
│   └── format.ts      # pure formatting helpers
└── types/calcite.d.ts # Calcite web components in React's JSX type space
```

**Data flow:** React state (`basemap`, layer visibility) → imperative updates on the live `MapView` (`map.basemap = …`, `layer.visible = …`). The view is created exactly once per mount; props never recreate it. SDK events (`view.watch`) flow back into React state through a stable, rAF-throttled callback.

**Why this split:** everything that imports `@arcgis/core` is isolated to `lib/` + `MapContainer`. UI components are framework-agnostic and unit-testable without the SDK, which is the same separation Esri's React integration guides recommend.

## Testing

- **Vitest + jsdom + React Testing Library**
- Pure logic (formatters, popup HTML builders, visibility hook) has full unit coverage
- Component tests render the real Calcite custom elements in jsdom and assert rendered attributes
- The SDK-facing factory is exercised in the browser, not in jsdom

## Learn more

- [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/)
- [Calcite Design System](https://developers.arcgis.com/calcite-design-system/)
- [React 19 custom elements](https://react.dev/reference/react-dom/components#custom-elements)
