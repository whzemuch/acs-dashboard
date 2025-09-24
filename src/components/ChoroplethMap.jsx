// src/components/ChoroplethMap.jsx
import React, { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl";
import { GeoJsonLayer } from "@deck.gl/layers";
import { csv } from "d3-fetch";
import { useDashboardStore } from "../store/dashboardStore";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const base = import.meta.env.BASE_URL;

// Utility: parse flow rows from CSV
function parseFlowRow(d) {
  return {
    year: +d.year,
    origin_geoid: String(d.origin_geoid).padStart(5, "0"),
    dest_geoid: String(d.dest_geoid).padStart(5, "0"),
    flow: +d.flow,
  };
}

export default function ChoroplethMap() {
  // ✅ Destructure store slices so React knows when to re-render
  const year = useDashboardStore((s) => s.year);
  const flowsByYear = useDashboardStore((s) => s.flowsByYear);
  const setFlowsForYear = useDashboardStore((s) => s.setFlowsForYear);

  const [counties, setCounties] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  // Load counties once
  useEffect(() => {
    fetch(`${base}data/geo/cb_2018_us_county_5m_boundaries.geojson`)
      .then((r) => r.json())
      .then((geo) => {
        console.log("Loaded counties geojson:", geo);
        setCounties(geo);
      })
      .catch((e) => console.error("Failed to load counties geojson", e));
  }, []);

  // Load flows for current year if not cached
  useEffect(() => {
    if (flowsByYear[year]) {
      console.log(
        `Flows already cached for ${year}`,
        flowsByYear[year].slice(0, 5)
      );
      return;
    }
    csv(`${base}data/flow/flow_${year}.csv`, parseFlowRow)
      .then((rows) => {
        console.log(`Loaded flows for ${year}:`, rows.slice(0, 5));
        setFlowsForYear(year, rows);
      })
      .catch((e) => console.error(`Failed to load flow_${year}.csv`, e));
  }, [year, flowsByYear, setFlowsForYear]);

  // Aggregate flows by destination (per year)
  const { colorByCounty, maxFlow } = useMemo(() => {
    if (!flowsByYear[year]) return { colorByCounty: {}, maxFlow: 0 };
    const agg = {};
    flowsByYear[year].forEach((row) => {
      agg[row.dest_geoid] = (agg[row.dest_geoid] || 0) + row.flow;
    });
    const maxVal = Math.max(...Object.values(agg), 0);
    console.log(
      `Aggregated ${Object.keys(agg).length} counties for year ${year}`
    );
    return { colorByCounty: agg, maxFlow: maxVal };
  }, [flowsByYear, year]);

  const initialViewState = { longitude: -98, latitude: 39, zoom: 3.4 };

  const layers = useMemo(() => {
    return [
      counties &&
        new GeoJsonLayer({
          id: `counties-${year}`, // 👈 force layer refresh per year
          data: counties,
          filled: true,
          stroked: true,
          getFillColor: (f) => {
            const geoid = f.properties.GEOID;
            const value = colorByCounty[geoid] || 0;
            if (!maxFlow) return [240, 240, 240, 120];
            const intensity = (value / maxFlow) * 255;
            return [255, 180 - intensity / 2, 0, 180]; // orange gradient
          },
          getLineColor: [100, 100, 100, 150],
          lineWidthMinPixels: 0.5,
          pickable: true,
          autoHighlight: true,
          onHover: (info) => {
            if (info.object) {
              const { GEOID, NAME } = info.object.properties;
              const value = colorByCounty[GEOID] || 0;
              setHoverInfo({
                x: info.x,
                y: info.y,
                text: `${NAME} (GEOID: ${GEOID})\nFlow In (${year}): ${value.toLocaleString()}`,
              });
            } else {
              setHoverInfo(null);
            }
          },
        }),
    ].filter(Boolean);
  }, [counties, colorByCounty, maxFlow, year]);

  return (
    <div style={{ position: "relative", height: "80vh", width: "80vw" }}>
      <DeckGL initialViewState={initialViewState} controller layers={layers}>
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v11"
        />
      </DeckGL>

      {hoverInfo && (
        <div
          style={{
            position: "absolute",
            pointerEvents: "none",
            left: hoverInfo.x + 12,
            top: hoverInfo.y + 12,
            background: "rgba(0,0,0,0.75)",
            color: "white",
            padding: "6px 8px",
            borderRadius: 6,
            fontSize: 12,
            whiteSpace: "pre-line",
          }}
        >
          {hoverInfo.text}
        </div>
      )}
    </div>
  );
}
