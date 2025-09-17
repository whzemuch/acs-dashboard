import { useState, useEffect, useMemo } from "react";
import DeckGL from "deck.gl";
import StaticMap from "react-map-gl";
import { GeoJsonLayer } from "deck.gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { scaleSequential } from "d3-scale";
import { interpolateYlGnBu } from "d3-scale-chromatic";
import { color as d3color } from "d3-color";

// --- Color scale for fill ---
const colorScale = scaleSequential(interpolateYlGnBu).domain([0, 1]);

// --- Helper to find stats for a given PUMA ---
function findStatsForPUMA(puma, data) {
  return data?.find((d) => String(d.PUMA) === String(puma));
}

function getInitialViewState() {
  return {
    longitude: -95,
    latitude: 37,
    zoom: 3,
    pitch: 0,
    bearing: 0,
  };
}


// --- Tooltip rendering on hover ---
function renderHoverInfo(hoverInfo, eduData) {
  if (!hoverInfo?.object) return null;

  const stats = findStatsForPUMA(hoverInfo.object.properties.PUMA, eduData);
  const pumaCode = hoverInfo.object.properties.PUMA;

  return (
    <div
      style={{
        position: "absolute",
        left: hoverInfo.x + 10,
        top: hoverInfo.y + 10,
        backgroundColor: "white",
        padding: "6px 8px",
        fontSize: "12px",
        borderRadius: "4px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        pointerEvents: "none",
        minWidth: "160px",
      }}
    >
      <b>{hoverInfo.object.properties.name}</b>
      {stats ? (
        <div style={{ marginTop: "4px" }}>
          {Object.entries(stats).map(([key, value]) => {
            if (key === "PUMA") return null;
            const displayValue =
              typeof value === "number"
                ? value >= 0 && value <= 1
                  ? (value * 100).toFixed(1) + "%"
                  : value.toLocaleString()
                : value;
            return (
              <div key={key}>
                {key}: {displayValue}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: "#777" }}>
          No education data for PUMA {pumaCode}
        </div>
      )}
    </div>
  );
}

const MAPBOX_TOKEN = "pk.eyJ1Ijoid2h6ZW11Y2giLCJhIjoiY21mNW1veXJuMDNzYzJsb21jOXZkb3Y5cyJ9.hP6BD6HV9rrR4NlzWt3DVA";

export default function PUMAMap() {
  const [geoData, setGeoData] = useState(null);
  const [eduData, setEduData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(() => {
    fetch("/data/geo/puma_shapes.json")
      .then((res) => res.json())
      .then((data) => {
        console.log("Loaded GeoJSON", data);
        setGeoData(data);
      });

    fetch("/data/education_by_puma_2023.json")
      .then((res) => res.json())
      .then((data) => {
        console.log("Loaded education JSON", data);
        setEduData(data.map((d) => ({ ...d, PUMA: Number(d.PUMA) })));
      });
  }, []);

  const getFillColor = (feature) => {
    const stats = findStatsForPUMA(feature.properties.PUMA, eduData);
    if (!stats) return [200, 200, 200, 100]; // gray for missing data
    const c = d3color(colorScale(stats.ba_or_higher));
    return [c.r, c.g, c.b, 200];
  };


  const layer = useMemo(() => {
  return new GeoJsonLayer({
    id: "puma-layer",
    data: geoData,
    filled: true,
    getFillColor,
    stroked: true,
    getLineColor: [255, 255, 255],
    lineWidthMinPixels: 1,
    pickable: true,
    onHover: (info) => {
      console.log("Hover event:", info);
      setHoverInfo(info && info.object ? info : null);
    },
  });
}, [geoData, eduData]);


return (
  <DeckGL
    style={{ position: "absolute", width: "100%", height: "100%" }}
    initialViewState={getInitialViewState()}
    controller={true}
    layers={[layer]}
  >
    <StaticMap
      mapStyle="mapbox://styles/mapbox/light-v9"
      mapboxAccessToken={MAPBOX_TOKEN}
    />
    {renderHoverInfo(hoverInfo, eduData)}
  </DeckGL>
);
}