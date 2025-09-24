// src/utils/renderHoverInfoWithCharts.js
import { Popup } from "react-map-gl";
import CoeffChart from "../components/CoeffChart";
import { getHoverRenderData } from "./renderHoverInfo";

export function renderHoverInfoWithCharts(hoverInfo, eduData, options = {}) {
  const data = getHoverRenderData(hoverInfo, options);
  if (!data) return null;

  const stats = eduData.find(
    (d) => d.PUMA === Number(data.content.properties?.PUMA),
  );
  if (!stats) return null;

  // Map popup
  if (data.type === "popup") {
    return (
      <Popup
        longitude={data.longitude}
        latitude={data.latitude}
        closeButton={false}
        closeOnClick={false}
        anchor="top"
      >
        {renderCharts(stats, data.content.properties?.name)}
      </Popup>
    );
  }

  // Screen tooltip
  if (data.type === "tooltip") {
    return (
      <div
        style={{
          position: "absolute",
          left: data.x,
          top: data.y,
          backgroundColor: "white",
          padding: "10px",
          borderRadius: "6px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          pointerEvents: "none",
          zIndex: 1000,
          width: "360px",
        }}
      >
        {renderCharts(stats, data.content.properties?.name)}
      </div>
    );
  }

  return null;
}

// helper: stacked charts
function renderCharts(stats, name) {
  return (
    <div>
      <b style={{ fontSize: "14px" }}>{name}</b>
      <div style={{ fontSize: "12px", color: "#555", marginBottom: "10px" }}>
        PUMA {stats.PUMA}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <h4 style={{ margin: "4px 0", fontSize: "12px" }}>
            Education Distribution
          </h4>
          <CoeffChart
            stats={stats}
            mode="distribution"
            width={340}
            height={160}
          />
        </div>

        <div>
          <h4 style={{ margin: "4px 0", fontSize: "12px" }}>Wage Premiums</h4>
          <CoeffChart
            stats={stats.coefficients}
            mode="coefficients"
            width={340}
            height={160}
          />
        </div>
      </div>
    </div>
  );
}
