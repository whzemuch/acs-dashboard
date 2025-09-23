// src/components/ChoroplethMap.jsx
import React, { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl";
import { GeoJsonLayer } from "@deck.gl/layers";
import { csv } from "d3-fetch";
import { useDashboardStore } from "../store/dashboardStore"; // consistent import

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const base = import.meta.env.BASE_URL;

// Utility: load flows and parse
function parseFlowRow(d) {
  return {
    year: +d.year,
    origin_geoid: String(d.origin_geoid).padStart(5, "0"),
    dest_geoid: String(d.dest_geoid).padStart(5, "0"),
    flow: +d.flow,
  };
}

export default function ChoroplethMap() {
  const { year, flowsByYear, setFlowsForYear } = useDashboardStore();
  const [counties, setCounties] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  // Load counties once
  useEffect(() => {
    fetch(`${base}data/geo/cb_2018_us_county_5m_boundaries.geojson`)
      .then((r) => r.json())
      .then(setCounties)
      .catch((e) => console.error("Failed to load counties geojson", e));
  }, []);

  // Load flows for current year if not cached
  useEffect(() => {
    if (flowsByYear[year]) return;
    csv(`${base}data/flow/flow_${year}.csv`, parseFlowRow)
      .then((rows) => setFlowsForYear(year, rows))
      .catch((e) => console.error(`Failed to load flow_${year}.csv`, e));
  }, [year, flowsByYear, setFlowsForYear]);

  // Aggregate flows by destination for choropleth
  const colorByCounty = useMemo(() => {
    if (!flowsByYear[year]) return {};
    const agg = {};
    flowsByYear[year].forEach((row) => {
      agg[row.dest_geoid] = (agg[row.dest_geoid] || 0) + row.flow;
    });
    return agg;
  }, [flowsByYear, year]);

  const initialViewState = { longitude: -98, latitude: 39, zoom: 3.4 };

  const layers = useMemo(() => {
    return [
      counties &&
        new GeoJsonLayer({
          id: "counties",
          data: counties,
          filled: true,
          stroked: true,
          getFillColor: (f) => {
            const geoid = f.properties.GEOID;
            const value = colorByCounty[geoid] || 0;
            const intensity = Math.min(255, Math.log(value + 1) * 40); // scaling
            return [255, 140 - intensity / 2, 0, 30]; // orange-based
          },
          getLineColor: [50, 50, 50, 200],
          lineWidthMinPixels: 1.5,
          pickable: true,
          autoHighlight: true,
          onHover: (info) => {
            if (info.object) {
              const { GEOID, NAME } = info.object.properties;
              const value = colorByCounty[GEOID] || 0;
              setHoverInfo({
                x: info.x,
                y: info.y,
                text: `${NAME} (GEOID: ${GEOID})\nFlow In: ${value.toLocaleString()}`,
              });
            } else {
              setHoverInfo(null);
            }
          },
        }),
    ].filter(Boolean);
  }, [counties, colorByCounty]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <DeckGL initialViewState={initialViewState} controller layers={layers}>
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v11"
          style={{ width: "100%", height: "100%" }}
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
