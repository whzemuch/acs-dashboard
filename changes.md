# Migration Data Integration Plan (Observed/Predicted + SHAP)

This document summarizes validation results, data partition strategy for GitHub Pages, and planned code changes to support the new state→county migration dataset with observed and predicted flows plus SHAP values.

## Overview

- Dataset: state→county flows (no year column), with columns:
  - `observed_movers`, `predicted_movers`, `shap_base_value`, and ~40 `shap_*` features
  - `origin_state_code` (may include non‑US region codes), `origin_state_name`
  - `dest_geoid` (5‑digit county FIPS), `dest_state_code`, `dest_county_code`, `dest_state_name`, `dest_county_name`
- Visualization goals:
  - Keep deck.gl ArcLayer (arcs from state centroid → county centroid)
  - Optional HeatmapLayer (destination density)
  - D3 SHAP panel to explain a selected arc (top +/- SHAP factors)

## Sanity Check Results

- File: `acs-dashboard/public/data/flow/migration_flows_with_shap_NATIVE.csv`
- Rows: ~65,017; CSV size: ~52.1 MB
- Integrity
  - `dest_geoid`’s state matches `dest_state_code`: OK (0 mismatches)
  - `dest_county_code` matches last 3 of `dest_geoid`: OK
  - `dest_state_name` is consistent per state code: OK
  - `dest_county_name` is consistent per county geoid: OK
  - `origin_state_code` contains non‑numeric region codes (e.g., ASI, EUR, CAM, AFR, SAM, NAM, CAR, OCE, ISL). Treat as “international regions,” not US states.
  - No negative values in observed/predicted movers.
- SHAP columns detected: 40

## Hosting & Size Estimates (GitHub Pages)

- Keep SHAP out of base flow partitions for speed; load SHAP on-demand.
- Estimated per‑row JSON (base, no SHAP): ~127 bytes
  - All rows once ≈ ~8.2 MB
  - With dual partitions (by destination AND by origin): ≈ ~16–18 MB total (spread across files)
- SHAP as objects is heavy (~1.5 KB/row). Prefer array format with a shared schema for ~350–450 bytes/row.
- Largest single partition (e.g., TX by destination) remains well under ~2 MB in both base and SHAP array formats.

## Partition Strategy

To minimize fetches and keep first paint fast:

- Base (no SHAP):
  - `public/data/cache/flows/by_dest/<SS>.json` — rows where `dest_state_code === <SS>`
  - `public/data/cache/flows/by_origin/<ID>.json` — rows where `origin_state_code === <ID>` (includes international region IDs)
- SHAP (arrays with fixed field order; fetched on click/open of SHAP panel):
  - `public/data/cache/flows/by_dest_shap/<SS>.json` — { id, shapBase, shapValues[] }
  - (Optional) `by_origin_shap/<ID>.json` if outbound SHAP exploration is needed
- Summaries & index:
  - `public/data/cache/summary.json` — inbound/outbound totals (observed and predicted):
    - county inbound, state inbound/outbound, optional adjacency (top‑K)
    - optional `topKRows` (national top flows) for instant initial render
  - `public/data/cache/index.json` — available partitions and counts

Rationale:
- Inbound views (state/county) load one file: `by_dest/<state>.json`
- Outbound views (state) load one file: `by_origin/<state>.json`
- Heatmap (destinations) uses `by_dest/*` slices
- Net and tooltips use `summary.json` instantly

## Cache Builder Changes (`scripts/build-flow-cache.js`)

- Input: `public/data/flow/migration_flows_with_shap_NATIVE.csv`
- Parse per row:
  - `originState` = `origin_state_code` (accept non‑numeric region codes)
  - `destCounty` = `dest_geoid` (5‑digit FIPS)
  - `flow` = `observed_movers`; `predicted` = `predicted_movers`
  - `shapBase` = `shap_base_value`; `shapValues` = ordered array of all `shap_*` columns
- Geometry:
  - `originPosition` from state centroid (or synthetic centroid for region codes)
  - `destPosition` from county centroid (existing county metadata)
- Outputs:
  - `public/data/cache/summary.json`
  - `public/data/cache/index.json`
  - `public/data/cache/flows/by_dest/<SS>.json` (base, no SHAP)
  - `public/data/cache/flows/by_origin/<ID>.json` (base, no SHAP)
  - `public/data/cache/flows/by_dest_shap/<SS>.json` (SHAP arrays)
  - `public/data/cache/shap_schema.json` (list of SHAP feature names in order)

## Data Provider Changes (`src/data/dataProvider.js`)

- Replace year‑based loading with partition‑based loading.
- Add `valueType` filter: `'observed' | 'predicted'`.
- Selection & sorting use `rowValue = valueType==='predicted' ? row.predicted : row.flow`.
- Metric behavior:
  - `in` (state/county): fetch `by_dest/<state>.json`
  - `out` (state only): fetch `by_origin/<state>.json` (disable at county scope)
  - `net` (state only): compute totals from `summary.json`; fetch arcs on demand
- Totals, tooltips: use `summary.json` for instant responsiveness.

## UI Changes

- Filters (`src/components/FilterPanel.jsx`):
  - Remove Year
  - Add `Value` toggle: Observed / Predicted
  - Add `Show heatmap` toggle
  - Disable `out` and `net` when a county is selected (dataset is state→county)
- Store (`src/store/dashboardStore.js`):
  - Add `selectedArc` and `setSelectedArc`

## Map Changes (`src/components/MigrationFlowMap.jsx`)

- ArcLayer: source = state (or region) centroid, target = county centroid
- Width/ordering determined by selected `valueType`
- HeatmapLayer (conditional): destination points weighted by `valueType`
- Click an arc → set `selectedArc` in store for SHAP panel

## SHAP Panel (`src/components/ShapPanel.jsx`)

- Displays for `selectedArc`:
  - Header: origin → dest, observed vs predicted, base value
  - Bar chart of SHAP contributions (top K by |value|), green=positive, red=negative
- Implementation notes:
  - Reuse `src/components/CoeffChart.jsx` in `coefficients` mode or a dedicated small D3 bar chart
  - Feature labeling: strip `shap_`, prettify snake_case to Title Case

## Open Questions

1) Keep SHAP separate (recommended) or embed in base partitions?
2) Include `topKRows` (national) in `summary.json` for instant national render?
3) Provide region centroid file for non‑US origins (e.g., ASI, EUR)?

## Next Steps

1) Update `scripts/build-flow-cache.js` to emit new partitions and summaries
2) Update `src/data/dataProvider.js` to partition‑based fetching and `valueType`
3) Add Value/Heatmap controls; enforce metric availability by scope
4) Implement SHAP panel and wire arc click → panel
5) Update `README.md` with data/partition details and usage
6) Test locally and verify GH Pages performance/file sizes

## Work Completed (this session)

- Added new builder: `scripts/build-flow-cache-shap.js`
  - Reads `public/data/flow/migration_flows_with_shap_NATIVE.csv`
  - Emits `public/data/cache/flows/by_dest/*.json`, `by_origin/*.json`, `by_dest_shap/*.json`, plus `summary.json`, `index.json`, and `shap_schema.json`
  - Handles 3‑digit state codes in CSV (e.g., `048`) → 2‑digit FIPS for destination files, preserves origin code for `by_origin`
- Added NPM script: `npm run build-cache-shap`
- Generated caches under `public/data/cache/` (verified sizes per partition under a few MB)
- Added new provider: `src/data/dataProviderShap.js` with `init()`, `getFlows()` (metric in/out/net; observed/predicted via `valueType`), `getSummary()`
- Added service wrapper: `src/data/flowServiceShap.js`

Pending wiring:
- Use `dataProviderShap` in `MigrationFlowMap` and add UI toggles (Value/Heatmap)
- Implement SHAP panel and click behavior

## Additional Work (follow-up)

- Wired `MigrationFlowMap` to `dataProviderShap` and added `HeatmapLayer` (toggle via filters)
- Added `Value` toggle (Observed/Predicted) and `showHeatmap` checkbox to FilterPanel
- Enforced dataset constraints: when a county is selected, only `Metric: Inbound` is allowed
- Implemented `ShapPanel` rendering SHAP contributions for a clicked arc; labels use `shap_schema.json`
