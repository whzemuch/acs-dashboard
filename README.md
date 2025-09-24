# ACS Dashboard

Interactive migration dashboard built with React, Deck.gl, and Vite. The app renders US county migration flows and a choropleth view from precomputed cache files, with demographic filters and state/county filtering.

## Getting Started

```bash
npm install
npm run build-cache   # generate public/data/cache/* JSON from the raw CSV/GeoJSON assets
npm run dev           # start the Vite dev server
```

The cache builder reads the files in `public/data/` (counties, states, flows, demographics) and emits:

- `public/data/cache/years.json`
- `public/data/cache/county-metadata.json`
- `public/data/cache/dimensions.json`
- `public/data/cache/flows/<year>.json`

Each per-year JSON contains flow slices plus inbound/outbound/net aggregates so the client never parses CSV at runtime.

## Testing

```bash
npm test
```

Vitest covers the data provider, worker fallback, store logic, and utility functions. In environments where Node cannot write `.vite-temp`, run tests locally.

## Filters & Interactions

- **Map View** – Toggle between `Flow` (arcs) and `Choropleth` shading.
- **Year** – Dropdown populated from cache (latest year is the default).
- **Metric** – Net, Inbound, or Outbound.
- **State / County** – Filtering selects states; counties list updates accordingly.
- **Min Flow** – Slider hides small flows.
- **Demographics** – Age, Income, and Education slices match the cache buckets.
- **Reset** – Restores default filters (latest year, flow view, minFlow=0, all demographics).

## Map Features

- **Flow View** (`MigrationFlowMap.jsx`)
  - Deck.gl `ArcLayer` + county polygons with state outlines.
  - Hover arcs to see slice flow, origin/destination inbound/outbound/net, plus demographic context.
  - Hover counties to see totals.
  - Flows are computed via a Web Worker when available (`flowService` + `flowWorkerClient`), falling back to the main thread otherwise.

- **Choropleth View** (`ChoroplethMap.jsx`)
  - County shading based on the current metric, with state outlines.
  - Hover tooltips include county/state, metric value, inbound/outbound/net totals, and demographic filters.

- **Trends Panel** (`TrendPanel.jsx`)
  - D3 line chart showing the net series across all cached years.
  - Optional inbound/outbound traces (auto-enabled when the Metric toggle is set to In/Out).
  - Highlights the selected year with a vertical guide and surfaces the current totals underneath.

## Data Source Expectations

The `scripts/build-flow-cache.js` script assumes the following inputs under `public/data/`:

- `geo/cb_2018_us_county_5m_boundaries.geojson`
- `geo/cb_2018_us_state_5m_boundaries.geojson`
- `geo/county_centroids.csv` (optional; map derives centroids if missing)
- `flow/flow_extended.csv` – extended flow slices (year, origin/dest GEOID, flow, age, income, education)

Adjust the script if your real data uses different filenames or additional dimensions (e.g., SHAP feature importance).

## Worker Notes

`flowService` automatically prefers the Web Worker (for heavy flow aggregation) when available. The Vitest suite mocks both success and failure paths to verify the fallback behavior.

## Recent Updates

- Added a D3 Trend Panel that charts net/inbound/outbound series for the active geography and shares the filter state with both maps.
- Updated the flow map’s default camera pitch/bearing so arcs are visible without manual tilting.
- Reworked the Test Map layout to align map, legend, and Trend Panel in a single 70 vw column (no vertical scroll).
- Choropleth map now recomputes its color scale immediately after a state filter change.
- Trend plotting now deduplicates year ticks and draws markers at every observation using the cache’s aggregated totals when possible.
