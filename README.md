# ACS Dashboard

## Main Features

- **Interactive migration flows** – deck.gl ArcLayer + Mapbox basemap visualize top county-to-county connections (Net, Inbound, Outbound) with sign-aware coloring and rich tooltips.
- **Dynamic trend analytics** – D3 trend panel charts inbound/outbound/net history for the active county, state, or national view and can expose component series on demand.
- **Rich filtering** – React + Zustand UI exposes year slider, metric toggle, geographic drill-down, demographic slices, and flow-threshold controls that stay in sync across map and charts.
- **Responsive UX** – Hover/click reveals demographic breakdowns, legends adapt to the active metric, and the layout fits desktop dashboards.

Live Demo: **[https://whzemuch.github.io/acs-dashboard/](https://whzemuch.github.io/acs-dashboard/)**

## Data Flow Overview

### Input Datasets

- `public/data/geo/cb_2018_us_county_5m_boundaries.geojson` – simplified county polygons (WGS84)
- `public/data/geo/county_centroids.csv` – precomputed lon/lat per county
- `public/data/flow/flow_extended.csv` – long-form flows (`year`, `origin`, `dest`, `flow`, optional `age`, `income`, `education`)
- Optional: SHAP/explainability CSVs or additional dimensions

### Preprocessing Pipeline

Run `node scripts/build-flow-cache.js` to emit cache files in `public/data/cache/`:

- `years.json` – available years
- `county-metadata.json` – geoid → {name, state, centroid}
- `dimensions.json` – age / income / education buckets
- `flows/{year}.json` – slice rows (sorted by flow) plus inbound/outbound totals and adjacency lists

This keeps the browser fast by avoiding runtime CSV parsing.

### Client Architecture

1. **Initialization** – `src/store/dashboardStore.js` calls `dataProvider.init()` to load metadata, dimensions, and defaults into Zustand.
2. **Flow retrieval** – `dataProvider.getFlows(filters)` ensures the year cache is loaded, filters slice rows by demographics/state/county, trims to top-N, and returns deck.gl-ready objects. A web worker (`src/workers/flowWorker.js`) handles heavy calls off the main thread.
3. **Map rendering** – `MigrationFlowMap` listens to filter changes, fetches flows + yearly summaries, and renders:
   - County/State GeoJson layers
   - ArcLayer with metric-aware colors (net gain/loss, inbound/outbound)
   - Hover tooltips showing slice flow, totals, demographics
4. **Charts & Panels** – Trend panel aggregates `getYearSummary` output to plot net/in/out history. Filter controls update the store, keeping map and chart in sync.
5. **Interaction loop** – user action → store updates → memoized selectors recompute → components re-render. Memoization + worker fallback keep the UI responsive.

Built-in performance practices: simplified geometries, precomputed centroids, per-year flow files, memoized selectors, top-N slicing, optional worker aggregation.

### New: SHAP Dataset (state→county) Pipeline

If you are using the new state→county migration CSV with observed/predicted movers and SHAP contributions (`public/data/flow/migration_flows_with_shap_NATIVE.csv`), run:

```
npm run build-cache-shap
```

This emits partitioned caches under `public/data/cache/`:

- `flows/by_dest/<SS>.json` and `flows/by_origin/<ID>.json` (base rows, no SHAP)
- `flows/by_dest_shap/<SS>.json` (SHAP arrays per destination state)
- `summary.json`, `index.json`, and `shap_schema.json`

A new data provider (`src/data/dataProviderShap.js`) can read these partitions and return deck.gl‑ready arcs. UI wiring is pending in this repo; see `changes.md` for the integration plan.

## Usage

### 1. Clone & Install

```bash
git clone https://github.com/whzemuch/acs-dashboard.git
cd acs-dashboard
npm install
```

### 2. Configure

- Create `.env.local` with `VITE_MAPBOX_TOKEN=...`
- (Optional) regenerate caches: `npm run build-cache` (requires source CSV/GeoJSON files under `public/data/`)

### 3. Develop

```bash
npm run dev
```

Open http://localhost:5173 to work with hot reload.

### 4. Build & Preview Production

```bash
npm run build
npx vite preview --base=/acs-dashboard/
```

Visit the printed URL (e.g., http://localhost:4173/acs-dashboard/). For GitHub Pages, run `npm run deploy` or rely on the deploy workflow.

### 5. Deploy

- Manual: `npm run deploy` pushes `dist/` to the `gh-pages` branch
- GitHub Actions (if configured): merging into `main` triggers the Pages workflow; ensure `VITE_MAPBOX_TOKEN` is set as a repo secret

## Data Specs & Demo Payloads

### Flow CSV Columns

```text
year, origin_geoid, dest_geoid, flow, [age], [income], [education], [origin_lon], [origin_lat], [dest_lon], [dest_lat]
```

Missing coordinates fall back to the centroid lookup.

#### Example Cache Row (`public/data/cache/flows/2020.json`)

```json
{
  "year": 2020,
  "maxFlow": 158.7412,
  "rows": [
    {
      "year": 2020,
      "origin": "16027",
      "dest": "36123",
      "flow": 158.7412,
      "originLon": -116.84537011524488,
      "originLat": 43.689253071998614,
      "destLon": -77.10332314814815,
      "destLat": 42.609325000000005,
      "age": "age_35_54",
      "income": "inc_lt_25k",
      "education": "edu_ba"
    }
  ],
  "inboundTotals": {
    "36123": 1946.0,
    "16027": 1271.0
  },
  "outboundTotals": {
    "16027": 3506.0,
    "36123": 1671.0
  }
}
```

### County Metadata (`county-metadata.json`)

```json
{
  "geoid": "06037",
  "state": "06",
  "stateName": "California",
  "name": "Los Angeles County",
  "lon": -118.2437,
  "lat": 34.0522
}
```

### Demo Geo Shapes (`public/data/geo/county_shapes.json`)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "GEOID": "06037", "name": "Los Angeles County" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-118.5, 34.0],
            [-118.1, 34.0],
            [-118.1, 34.2],
            [-118.5, 34.2],
            [-118.5, 34.0]
          ]
        ]
      }
    }
  ]
}
```

Extend these stubs with full ACS exports or additional explainability files—the DataProvider automatically picks up new dimensions added to `dimensions.json` and per-year flow caches.
