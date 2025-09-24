# ACS Dashboard

Data files (recommended)

Boundaries (static): counties.geojson (GEOID, NAME, geometry) — simplified for web (e.g., with mapshaper).

Centroids (static): county_centroids.csv (GEOID, lon, lat) — precomputed so arcs don’t compute centroids on the fly.

Flows (per year): flows_2018.csv, …, flows_2022.csv
Columns: year,origin_geoid,dest_geoid,flow
(Optional extra: group for demographic slice.)

(Later) SHAP/Feature importance: shap\_{year}.csv keyed by GEOID or GEOID_origin,GEOID_dest.

DataProvider (single source of truth)

Why: keep parsing/joins/memoization in one place so Map & Trends stay fast and in sync.

Load files (fetch + PapaParse for CSV).

Build indices:

byYear[year] = flows array

centroidById[GEOID] = {lon,lat}

nameById[GEOID] = NAME

Selectors (memoized):

getFlows(year, stateFilter?, threshold?, metric) → array for ArcLayer

getNetSeries(geoid) → [{year, net}] for Trends panel

getInOutSeries(geoid) → [{year, in, out}] when user toggles

Optional: do heavy aggregations in a Web Worker (nice win if flows get big).

Minimal state to keep in a small Zustand/Redux store: year, viewMode ('county'|'state'), metric ('net'|'in'|'out'), stateFilter, selectedGEOID, threshold.

MapView (deck.gl)

Layers:

GeoJsonLayer (counties)

data: counties.geojson

getFillColor: neutral gray (or themed)

onHover: show county name + net for current year

Pickable: yes

ArcLayer (flows)

data: selector.getFlows(...)

getSourcePosition: from centroidById[origin_geoid]

getTargetPosition: from centroidById[dest_geoid]

getWidth: scale by flow (e.g., sqrt)

getSourceColor/getTargetColor:

Net view: color by sign from selected target county

In/Out view: consistent palette (e.g., in=blue, out=orange)

Performance knobs: draw top N flows or flow >= threshold

Default view

National extent

Year = most recent observed (or 2021)

Metric = Net migration

Threshold = reasonable (e.g., top 10 flows per selected county or flow ≥ 300)

TrendsPanel (D3)

Input: getNetSeries(selectedGEOID) (default: national aggregate if nothing selected).

Line chart

X = year, Y = net (or in/out if toggled)

2 series if you later add predictions: Observed vs Predicted

Tooltip: year, in, out, net

Responds to: year hover (optional crosshair) & filter changes

FilterPanel

Year slider: 2018–2022 (or 2013–2025 when real)

Metric toggle: Net (default) / In / Out

State dropdown: (optional) filters flows & map to that state’s counties

Search / Select county: sets selectedGEOID

Flow threshold slider: hides tiny arcs for clarity

Data flow (what happens when user interacts)

User moves Year slider → store updates {year}

DataProvider recomputes memoized flows for that year & filter

MapView gets new flows for ArcLayer and re-renders

If a county is clicked, store sets {selectedGEOID}

DataProvider computes net series for that county

TrendsPanel re-renders with that time series

Performance tips (with ~3k counties, 5 years)

Pre-simplify geometry (mapshaper: -simplify 10% keep-shapes); keep WGS84 (EPSG:4326).

Precompute centroids server-side and ship county_centroids.csv.

Chunk flows by year (separate CSVs) so you only load what you need.

Threshold small flows by default; expose a slider to reveal more.

Use memoized selectors (Reselect or Zustand selectors) to avoid redoing aggregations.

For very large flows, consider deck.gl binary data (typed arrays) or push heavy groupbys into a Web Worker.

Performance tips (with ~3k counties, 5 years)

Pre-simplify geometry (mapshaper: -simplify 10% keep-shapes); keep WGS84 (EPSG:4326).

Precompute centroids server-side and ship county_centroids.csv.

Chunk flows by year (separate CSVs) so you only load what you need.

Threshold small flows by default; expose a slider to reveal more.

Use memoized selectors (Reselect or Zustand selectors) to avoid redoing aggregations.

For very large flows, consider deck.gl binary data (typed arrays) or push heavy groupbys into a Web Worker.

“Start small” build plan (incremental)

Milestone 1 — Skeleton & data loading

Render layout, load counties.geojson, draw GeoJsonLayer only.

Hardcode one year; no arcs yet.

Milestone 2 — Centroids & flows

Load county_centroids.csv + one flows_YYYY.csv

Draw ArcLayer for that year (top N flows nationally)

Add tooltip for arcs

Milestone 3 — Filters

Add Year slider → swap flow file (or filter in memory)

Add threshold slider → update ArcLayer data

Add county click → selectedGEOID in store

Milestone 4 — TrendsPanel (D3)

Compute in/out/net per year for selected county

Line chart with hover

Milestone 5 — State filter + polish

Dropdown to filter counties to a state (improves clarity & perf)

Legends, color ramps, null states, no-data UX

Milestone 6 — Predictions & explainability (stretch)

Add predicted series to TrendsPanel

Inject SHAP top features for selected county/year (bar chart)

+-----------------------------------------------------------------------+
| Header: U.S. Migration Flows Dashboard (2013–2025) |
+-----------------------------------------------------------------------+
| LEFT PANEL (Filters) | MAIN VIEW (Map + Charts) |
|---------------------------------------+--------------------------------|
| 📍 Geography | 🗺️ Deck.gl Map |
| - State dropdown | - County polygons (GeoJSON) |
| - County search / select | - County-to-County ArcLayer |
| | • Arc width = flow volume |
| 🕒 Time | • Arc color = metric |
| - Year slider 2013–2025 | |
| | 📈 D3 Trends Panel |
| ⚖️ Metric | - Line chart for selected |
| - (•) Net (default) | county: net over time |
| - ( ) In-migration | - Toggle: show In/Out lines |
| - ( ) Out-migration | - If no county selected: |
| | show national (or state) |
| 🔎 Flow Threshold | aggregate trend |
| - Min flow slider | |
| | 🧠 Feature Importance Panel |
| 👤 Demographics (optional) | - Top drivers (bar chart) |
| - Age / Income / Education toggles | for selected county/year |
| | - Source: model SHAP/weights |
|---------------------------------------+--------------------------------|
| Legend / Tooltip | Footer: Data sources & notes |
| - Color scale for metric | - ACS (county), simulated flows|
| - Units & thresholds | - Disclaimer if simulated |
+-----------------------------------------------------------------------+

An interactive web-based dashboard for visualizing American Community Survey (ACS) data at the PUMA (Public Use Microdata Area) level.  
Built with **React, Deck.gl, Mapbox, D3.js, and Vite**, this project allows users to explore geographic education data and related metrics.

---

## Features

Live Demo: **[View the deployed site](https://whzemuch.github.io/acs-dashboard/)**

- Interactive **map of PUMA regions** using Deck.gl + Mapbox
- **Hover tooltips & popups** with education stats visualized by D3.js
- **Responsive layout** using React components

---

## Getting Started

### 1. Clone this repo

```bash
git clone https://github.com/whzemuch/acs-dashboard.git
cd acs-dashboard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run locally (development mode)

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### 4. Preview the Production Build

```bash
npm run build
npx vite preview --base=/acs-dashboard/
```

Then open the printed local URL like
http://localhost:4173/acs-dashboard/.

### Example Pseudo Data

For the demo purpose, I just used this minimal example:

public/data/education_by_puma_2023.json

```json
[
  {
    "PUMA": 101,
    "city": "Los Angeles",
    "ba_or_higher": 0.42,
    "coefficients": { "hs": 1.0, "ba": 1.5, "grad": 2.1 }
  },
  {
    "PUMA": 202,
    "city": "San Antonio",
    "ba_or_higher": 0.35,
    "coefficients": { "hs": 1.0, "ba": 1.4, "grad": 1.9 }
  },
  {
    "PUMA": 303,
    "city": "New York",
    "ba_or_higher": 0.58,
    "coefficients": { "hs": 1.0, "ba": 1.7, "grad": 2.3 }
  }
]
```

public/data/geo/puma_shapes.json (simplified shapes)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "PUMA": 101, "name": "Los Angeles" },
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
    },
    {
      "type": "Feature",
      "properties": { "PUMA": 202, "name": "San Antonio" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-98.6, 29.3],
            [-98.3, 29.3],
            [-98.3, 29.6],
            [-98.6, 29.6],
            [-98.6, 29.3]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": { "PUMA": 303, "name": "New York" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.1, 40.6]
          ]
        ]
      }
    }
  ]
}
```
