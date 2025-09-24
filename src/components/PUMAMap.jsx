// src/views/PUMAMap.jsx

import { useState, useEffect, useMemo } from "react";
import DeckGL from "deck.gl";
import StaticMap, { Popup } from "react-map-gl";
import { GeoJsonLayer } from "deck.gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { scaleSequential } from "d3-scale";
import { interpolateYlGnBu } from "d3-scale-chromatic";
import { color as d3color } from "d3-color";

import { getHoverRenderData } from "../utils/getHoverData";
import { findStatsForPUMA, getInitialViewState } from "../utils/pumaHelpers";
import CoeffChart from "../components/CoeffChart";

const base = import.meta.env.BASE_URL; // for Vite base path
const colorScale = scaleSequential(interpolateYlGnBu).domain([0, 1]);
const MAPBOX_TOKEN =
  "pk.eyJ1Ijoid2h6ZW11Y2giLCJhIjoiY21mNW1veXJuMDNzYzJsb21jOXZkb3Y5cyJ9.hP6BD6HV9rrR4NlzWt3DVA";

export default function PUMAMap() {
  const [geoData, setGeoData] = useState(null);
  const [eduData, setEduData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(() => {
    fetch(`${base}data/geo/puma_shapes.json`)
      .then((res) => res.json())
      .then(setGeoData);

    fetch(`${base}data/education_by_puma_2023.json`)
      .then((res) => res.json())
      .then((data) =>
        setEduData(data.map((d) => ({ ...d, PUMA: Number(d.PUMA) }))),
      );
  }, []);

  const getFillColor = (feature) => {
    const stats = findStatsForPUMA(feature.properties.PUMA, eduData);
    if (!stats) return [200, 200, 200, 100];
    const c = d3color(colorScale(stats.ba_or_higher));
    return [c.r, c.g, c.b, 200];
  };

  const layer = useMemo(
    () =>
      new GeoJsonLayer({
        id: "puma-layer",
        data: geoData,
        filled: true,
        getFillColor,
        stroked: true,
        getLineColor: [255, 255, 255],
        lineWidthMinPixels: 1,
        pickable: true,
        onHover: (info) => setHoverInfo(info && info.object ? info : null),
      }),
    [geoData, eduData],
  );

  if (!geoData || !eduData) return <div>Loading map data...</div>;

  const hoverRender = getHoverRenderData(hoverInfo);

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
      >
        {hoverRender?.type === "popup" && (
          <Popup
            longitude={hoverRender.longitude}
            latitude={hoverRender.latitude}
            closeButton={false}
            closeOnClick={false}
            anchor="top"
          >
            {renderTooltipContent(hoverRender.content, eduData)}
          </Popup>
        )}
      </StaticMap>

      {hoverRender?.type === "tooltip" && (
        <div
          style={{
            position: "absolute",
            left: hoverRender.x,
            top: hoverRender.y,
            backgroundColor: "white",
            padding: "8px",
            borderRadius: "6px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            pointerEvents: "none",
            zIndex: 1000,
            width: "320px",
          }}
        >
          {renderTooltipContent(hoverRender.content, eduData)}
        </div>
      )}
    </DeckGL>
  );
}

function renderTooltipContent(obj, eduData) {
  const pumaCode = obj.properties.PUMA;
  const name = obj.properties.name;
  const stats = eduData.find((d) => d.PUMA === Number(pumaCode));

  if (!stats) {
    return (
      <div style={{ color: "#777" }}>No education data for PUMA {pumaCode}</div>
    );
  }

  return (
    <div>
      <b>{name}</b>
      <div style={{ fontSize: "11px", color: "#777", marginBottom: "6px" }}>
        PUMA {pumaCode}
      </div>

      {/* Education distribution */}
      <CoeffChart stats={stats} mode="distribution" width={200} height={120} />

      {/* Wage premiums */}
      <CoeffChart
        stats={stats.coefficients}
        mode="coefficients"
        width={200}
        height={120}
      />
    </div>
  );
}
