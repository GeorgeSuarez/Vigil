# City Explorer

A polished, deployable mapping app built with the **ArcGIS Maps SDK for JavaScript**, **React 19**, **TypeScript (strict)**, and the **Calcite Design System** — the stack Esri's own product teams use.

Built as a portfolio project targeting Esri frontend roles such as:

- **Application Developer – JavaScript** (Geo Experience Center)
- **Software Engineer I – Front-End Engineer, ArcGIS Enterprise**
- **TypeScript Software Development Engineer II** (ArcGIS Business Analyst)

## Features

- 🗺️ **ArcGIS Maps SDK for JavaScript 5.x** via tree-shakeable ES module imports (`@arcgis/core`)
- 🧩 **Calcite Design System** web components (`calcite-switch`, `calcite-select`, `calcite-chip`) used natively from React 19
- 📡 Two keyless public **FeatureLayers** (global earthquakes with clustering, Atlantic hurricanes) with custom popup templates
- 🔎 Search (geocoding) widget enabled when an API key is configured
- 📊 Live status bar — map center, zoom, scale — driven by SDK `watch` handlers
- 🌓 Dark, glassy UI with the SDK's dark theme and Calcite dark mode
- ♻️ View lifecycle done right: created once on mount, destroyed on unmount (StrictMode-safe)

## Quick start

```bash
npm install
npm run dev
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
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest (run once) |
| `npm run test:watch` | Vitest watch mode |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run format` | oxfmt write |

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

## Deployment

Any static host works — the app is a plain Vite SPA:

- **Vercel:** import the repo; set `VITE_ARCGIS_API_KEY` in project env vars
- **Netlify:** build command `npm run build`, publish `dist`

## Roadmap

Planned extensions that map to the Esri role postings this project targets:

1. **Accessibility pass** — keyboard navigation, ARIA-live map announcements, reduced-motion (WCAG/ARIA is an explicit requirement of the ArcGIS Enterprise front-end role)
2. **Natural-language map query** — LLM parses a question into ArcGIS queries (matches Esri's AI/agent direction)
3. **Component library extraction** — promote the map UI patterns into a Storybooked web-component library
4. **i18n** — react-i18next with RTL support

## Learn more

- [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/)
- [Calcite Design System](https://developers.arcgis.com/calcite-design-system/)
- [React 19 custom elements](https://react.dev/reference/react-dom/components#custom-elements)
- [Esri careers](https://www.esri.com/en-us/about/careers/job-search)
