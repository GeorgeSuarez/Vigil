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
- ⏱️ **Time slider** — dual-thumb temporal filter over the quakes layer (SDK `TimeSlider` + `layer.timeInfo`); the map and the in-view counts both react to the active window. The range is derived from the layer's own time extent at load, not hardcoded. The band is collapsed by default at every width — the clock in the status bar reveals it, and collapsing it again releases the filter rather than leaving the map silently filtered.
- ♿ **Accessibility** — landmarks with accessible names, a screen-reader announcer (ARIA live region) narrating settled map state, visible focus states, and `prefers-reduced-motion` support; every SDK-free component passes an axe audit in the unit suite.
- 💬 **Ask the map** — natural-language commands ("M5 in Alaska", "last 3 days", "zoom to Japan", "clear filters") drive real map operations: layer definition expressions, animated fly-to, and the temporal window. Runs keyless via a pure offline parser; configure an OpenAI, OpenCode Zen, or Anthropic key to route through LLM tool-calls instead (`VITE_LLM_PROVIDER` + `VITE_LLM_API_KEY`).
- ☁️ **Cloudflare deployment** — the static SPA ships as a Cloudflare Worker with static assets and SPA fallback routing; `cloudflare.config.ts` plus the Cloudflare Vite plugin produce the Build Output that `cf deploy` uploads.

## Quick start

```bash
pnpm install
pnpm dev
```

Requires Node `^22.23.0 || ^24.22.0 || ^26.12.0` (the Cloudflare CLI's engine range; CI uses Node 26) and pnpm (the exact version is pinned by `packageManager` in `package.json`).

Open http://localhost:5173. The app runs **without any API key** — it uses the OpenStreetMap basemap and Esri's public sample services.

### Optional: ArcGIS API key

1. Create a free [ArcGIS Location Platform](https://locationplatform.arcgis.com/) developer account.
2. Copy `.env.example` to `.env.local` and paste your key:

   ```env
   VITE_ARCGIS_API_KEY=YOUR_KEY
   ```

3. Restart the dev server. You now get Esri vector basemaps plus the Search widget.

### Optional: LLM key for "Ask the map"

The panel works offline by default. To route commands through an LLM, choose a provider and set its key:

```env
VITE_LLM_PROVIDER=openai   # anthropic | openai | opencode
VITE_LLM_API_KEY=YOUR_KEY
```

| Provider | Default endpoint | Default model |
| --- | --- | --- |
| `anthropic` | `https://api.anthropic.com/v1/messages` | `claude-haiku-4-5-20251001` |
| `openai` | `https://api.openai.com/v1/chat/completions` | `gpt-6-luna` |
| `opencode` | `https://opencode.ai/zen/v1/chat/completions` | `glm-5.3-flash` |

`VITE_LLM_MODEL` overrides the default model. `openai` also covers any OpenAI-compatible gateway: set `VITE_LLM_BASE_URL` and the app appends `/chat/completions` (or `/messages` for `anthropic`) when the path is missing. OpenCode Go keys use the same provider with `VITE_LLM_BASE_URL=https://opencode.ai/zen/go/v1` and a model available to Go.

`opencode` calls OpenCode Zen's OpenAI-compatible Chat Completions endpoint. If you override the model, choose one served there (for example `glm-5.3-flash`, `kimi-k2.7-code`, or `deepseek-v4.1-flash`).

Provider-specific aliases work too: `VITE_OPENAI_API_KEY`, `VITE_OPENCODE_API_KEY`, and `VITE_ANTHROPIC_API_KEY` select their provider automatically, so a single key is enough. The generic `VITE_LLM_API_KEY` wins when both are set, and the legacy `VITE_ANTHROPIC_MODEL` still works. Any LLM failure falls back to the offline parser.

Restart the dev server after changing `.env.local`. Vite embeds `VITE_*` values in the client bundle, so use scoped/demo keys and never commit `.env.local`. LLM calls run in the browser, so the provider must allow CORS; use `VITE_LLM_BASE_URL` to point at a proxy if needed.

### Deploy to Cloudflare

The app deploys as a **Cloudflare Worker with static assets** (the new Pages-on-Workers path). `cloudflare.config.ts` sets the Worker name (`arcgis-vigil`) and SPA fallback, and the Cloudflare Vite plugin produces the Build Output.

```bash
pnpm install
pnpm run deploy:dry-run   # typecheck + build + validate, no upload
pnpm run deploy           # typecheck + build + deploy
```

Use `pnpm run deploy` — `pnpm deploy` is pnpm's own built-in command and will not run the script. The deploy scripts run `tsc -b` first, then `cf deploy`, which builds with Vite and uploads the Worker. To split build from upload:

```bash
pnpm exec tsc -b
pnpm exec cf build
pnpm exec cf deploy --prebuilt --mode production
```

The first deploy prints the `*.workers.dev` URL. This project is live at <https://arcgis-vigil.georgesuarezdev.workers.dev>. `VITE_*` values are baked into the client bundle at build time, so set them in `.env.local` locally or in the CI environment when deploying — Cloudflare runtime variables do not affect the static build.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | Typecheck + production build |
| `pnpm preview` | Serve the production build |
| `pnpm run deploy` | Typecheck + build + deploy to Cloudflare with `cf deploy` |
| `pnpm run deploy:dry-run` | Typecheck + build + validate, without uploading |
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
│   ├── StatusBar.tsx  #   live center/zoom/scale readout + in-view counts
│   └── VigilStat.tsx  #   React wrapper for the <vigil-stat> element
├── elements/
│   └── vigil-stat.ts  #   <vigil-stat>: shadow DOM, slots, parts, token theming
├── hooks/
│   ├── useLayerVisibility.ts    # pure toggle state logic
│   ├── useNlqRunner.ts          # NLQ executor lifecycle (offline parser or LLM)
│   ├── useSettledAnnouncement.ts # debounced screen-reader narration
│   └── useUrlMapState.ts        # URL-hash persistence
├── lib/
│   ├── arcgis.ts      # ArcGIS env config + esriConfig wiring
│   ├── basemaps.ts    # basemap option data
│   ├── createMapController.ts # SDK factory: Map, MapView, widgets, watchers
│   ├── eonet.ts       # NASA EONET fetch + property flattening
│   ├── format.ts      # pure formatting helpers
│   ├── icons.ts       # inline SVG glyph paths for EONET categories and ISS
│   ├── layers.ts      # layer descriptors, popup HTML, renderers, ISS polling
│   ├── urlState.ts    # shareable URL-hash parsing and serialisation
│   └── nlq/
│       ├── execute.ts   # intent → map operations
│       ├── llm.ts       # optional LLM tool-call path (Anthropic/OpenAI/OpenCode)
│       ├── llmConfig.ts # provider/key/model resolution for the optional LLM path
│       └── parser.ts    # offline rule-based parser + region table
└── types/calcite.d.ts # Calcite web components in React's JSX type space
```

**Data flow:** React state (`basemap`, layer visibility) → imperative updates on the live `MapView` (`map.basemap = …`, `layer.visible = …`). The view is created exactly once per mount; props never recreate it. SDK events (`reactiveUtils.watch`) flow back into React state through a stable, rAF-throttled callback.

**Why this split:** everything that imports `@arcgis/core` is isolated to `lib/`, `MapContainer`, and the one network-backed integration test. UI components are framework-agnostic and unit-testable without the SDK, which is the same separation Esri's React integration guides recommend.

**Why a hand-authored element:** the status bar's label/value pairs are the app's most repeated atom, and they are the one place where the content must stay in the light DOM — a screen reader reads them in document order, and the tests query them with `getByText`. So the shadow root owns only layout, weight and tone, while `<slot name="label">` and `<slot name="value">` carry the text. Consumers get exactly two hooks: the exported `parts` (`label`, `value`) and the `--vigil-stat-*` custom properties; no internal selector is public. `<vigil-stat>` ships as a plain class registered once (guarded, so HMR and StrictMode cannot re-define it) plus a thin React 19 wrapper that relies on React assigning declared properties rather than stringifying attributes.

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
