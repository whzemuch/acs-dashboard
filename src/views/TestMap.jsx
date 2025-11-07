import React from "react";

import FilterPanel from "../components/FilterPanel.jsx";
import LegendPanel from "../components/LegendPanel.jsx";
import ChoroplethMap from "../components/ChoroplethMap.jsx";
import MigrationFlowMap from "../components/MigrationFlowMap.jsx";
import SummaryPanel from "../components/SummaryPanel.jsx";
import ShapPanel from "../components/ShapPanel.jsx";
import { useDashboardStore } from "../store/dashboardStore";

export default function TestMap() {
  const viewMode = useDashboardStore((s) => s.filters.viewMode ?? "choropleth");
  const isFlowView = viewMode === "flow";
  const mapTitle = isFlowView ? "Flow View" : "Choropleth View";
  const mapComponent = isFlowView ? <MigrationFlowMap /> : <ChoroplethMap />;
  const legendLayout = isFlowView ? "flow" : "choropleth";

  return (
    <div
      style={{
        display: "flex",
        gap: "24px",
        alignItems: "flex-start",
        padding: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          width: 260,
          flexShrink: 0,
        }}
      >
        <FilterPanel />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 600,
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxWidth: "70vw",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "24px",
            alignItems: "center",
          }}
        >
          <div style={{ flexShrink: 0, width: "70vw", height: "60vh" }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 18,
                textAlign: "center",
              }}
            >
              {mapTitle}
            </h2>
            <div style={{ width: "100%", height: "55vh" }}>{mapComponent}</div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <LegendPanel layout={legendLayout} />
          </div>
        </div>
        <SummaryPanel />
        <ShapPanel />
      </div>
    </div>
  );
}
