import React, { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl";
import { ArcLayer, GeoJsonLayer } from "@deck.gl/layers";
import { csv } from "d3-fetch";
import { useDashboardStore } from "../store/dashboardStore"; //

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const base = import.meta.env.BASE_URL; // important for Vite

function parseFlowRow(d) {
  return {
    year: +d.year,
    origin_geoid: String(d.origin_geoid).padStart(5, "0"),
    origin_name: d.origin_name,
    origin_lon: +d.origin_lon,
    origin_lat: +d.origin_lat,
    dest_geoid: String(d.dest_geoid).padStart(5, "0"),
    dest_name: d.dest_name,
    dest_lon: +d.dest_lon,
    dest_lat: +d.dest_lat,
    flow: +d.flow,
  };
}

export default function CountyMap() {
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

  // Lazy-load flows for the selected year
  useEffect(() => {
    if (flowsByYear[year]) return;
    csv(`${base}data/flow/flow_${year}.csv`, parseFlowRow)
      .then((rows) => setFlowsForYear(year, rows))
      .catch((e) => console.error(`Failed to load flow_${year}.csv`, e));
  }, [year, flowsByYear, setFlowsForYear]);

  const arcs = useMemo(
    () =>
      (flowsByYear[year] || []).map((r) => ({
        source: [r.origin_lon, r.origin_lat],
        target: [r.dest_lon, r.dest_lat],
        value: r.flow,
        oName: r.origin_name,
        dName: r.dest_name,
      })),
    [flowsByYear, year]
  );

  const initialViewState = { longitude: -98, latitude: 39, zoom: 3.4 };

  const layers = useMemo(() => {
    return [
      counties &&
        new GeoJsonLayer({
          id: "counties",
          data: counties,
          stroked: true,
          filled: true,
          getFillColor: [220, 220, 220, 80],
          getLineColor: [120, 120, 120],
          lineWidthUnits: "pixels",
          pickable: true,
          onHover: (info) =>
            setHoverInfo(
              info.object
                ? {
                    x: info.x,
                    y: info.y,
                    text: info.object.properties.NAME,
                  }
                : null
            ),
        }),
      new ArcLayer({
        id: "flows",
        data: arcs,
        pickable: true,
        getSourcePosition: (d) => d.source,
        getTargetPosition: (d) => d.target,
        getWidth: (d) => Math.max(1, Math.sqrt(d.value) / 10),
        getSourceColor: [0, 120, 220, 180],
        getTargetColor: [220, 0, 90, 180],
        onHover: ({ x, y, object }) =>
          setHoverInfo(
            object
              ? {
                  x,
                  y,
                  text: `${object.oName} → ${
                    object.dName
                  }\nFlow: ${object.value.toLocaleString()}`,
                }
              : null
          ),
      }),
    ].filter(Boolean);
  }, [counties, arcs]);

  return (
    <div style={{ position: "relative", height: "100vh" }}>
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
