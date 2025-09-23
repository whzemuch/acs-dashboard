import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl";
import React from "react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function TestMap() {
  const initialViewState = {
    longitude: -98,
    latitude: 39,
    zoom: 3,
    pitch: 0,
    bearing: 0,
  };

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <DeckGL initialViewState={initialViewState} controller>
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/streets-v11"
        />
      </DeckGL>
    </div>
  );
}
