import { useState, useEffect } from "react";
import DeckGL from "deck.gl";
import StaticMap from "react-map-gl";
import { GeoJsonLayer } from 'deck.gl'
import "mapbox-gl/dist/mapbox-gl.css";


import { scaleSequential } from "d3-scale";
import { interpolateYlGnBu } from "d3-scale-chromatic";
import { color as d3color } from "d3-color";



// --- helper functions ---
function buildTooltip(object, eduData) {
  if (!object) return null;

  const stats = eduData?.find((d) => d.PUMA === object.properties.PUMA);
  if (!stats) return object.properties.name;

  return {
    html: `<b>${object.properties.name}</b><br/>% BA+: ${(stats.ba_or_higher * 100).toFixed(1)}%`,
    style: {
      backgroundColor: "white",
      color: "black",
      padding: "4px",
      borderRadius: "4px",
    },
  };
}


function renderHoverInfo(hoverInfo, eduData) {
  if (!hoverInfo?.object) return null;

    const stats = eduData?.find(
  (d) => String(d.PUMA) === String(hoverInfo.object.properties.PUMA)
);

    console.log("Hover PUMA:", hoverInfo.object.properties.PUMA);
    console.log(
    "eduData IDs:",
            eduData?.map((d) => [typeof d.PUMA, d.PUMA])
    );


  console.log("EDU data loaded:", Array.isArray(eduData), eduData?.length);

  return (
    <div
      style={{
        position: "absolute",
        left: hoverInfo.x,
        top: hoverInfo.y,
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
            if (key === "PUMA") return null; // skip ID
            let displayValue = value;
            if (typeof value === "number") {
              // heuristic: format percentages if between 0–1
              displayValue =
                value >= 0 && value <= 1
                  ? (value * 100).toFixed(1) + "%"
                  : value.toLocaleString();
            }
            return (
              <div key={key}>
                {key}: {displayValue}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: "#777" }}>
          No education data for PUMA {hoverInfo.object.properties.PUMA}
        </div>
      )}
    </div>
  );
}





// Scale: input domain [0,1] → output color

const colorScale = scaleSequential(interpolateYlGnBu).domain([0, 1]);





const MAPBOX_TOKEN = "pk.eyJ1Ijoid2h6ZW11Y2giLCJhIjoiY21mNW1veXJuMDNzYzJsb21jOXZkb3Y5cyJ9.hP6BD6HV9rrR4NlzWt3DVA"; // replace this

export default function PUMAMap() {
  const [geoData, setGeoData] = useState(null);
  const [eduData, setEduData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(() => {
    fetch("/data/geo/puma_shapes.json")
      .then(res => res.json())
      .then((data) => {
        console.log("Loaded GeoJSON", data);
        setGeoData(data);
      });

    fetch("/data/education_by_puma_2023.json")
      .then(res => res.json())
      .then((data) => {
        console.log("Loaded education JSON", data);
        setEduData(data.map(d => ({ ...d, PUMA: Number(d.PUMA) })));
      });
  }, []);

  if (!geoData || !eduData) {
    return <div>Loading map data...</div>;
  }

  const getFillColor = (f) => {
    const stats = eduData.find(
      (d) => String(d.PUMA) === String(f.properties.PUMA)
    );
    if (!stats) return [0, 200, 0, 180]; // fallback green
    const c = d3color(colorScale(stats.ba_or_higher));
    return [c.r, c.g, c.b, 200];
  };

  const layer = new GeoJsonLayer({
    id: "puma-layer",
    data: geoData,
    filled: true,
    getFillColor,
    stroked: true,
    getLineColor: [255, 255, 255],
    lineWidthMinPixels: 1,
    pickable: true,
    onHover: setHoverInfo,
  });

  return (
    <DeckGL
      initialViewState={{
        longitude: -95,
        latitude: 37,
        zoom: 3,
        pitch: 0,
        bearing: 0
      }}
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

