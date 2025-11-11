import React, { useState } from "react";

import FilterPanel from "../components/FilterPanel.jsx";
import LegendPanel from "../components/LegendPanel.jsx";
import ChoroplethMap from "../components/ChoroplethMap.jsx";
import MigrationFlowMap from "../components/MigrationFlowMap.jsx";
import SummaryPanel from "../components/SummaryPanel.jsx";
import ShapPanel from "../components/ShapPanel.jsx";
import TopDestinationsPanel from "../components/TopDestinationsPanel.jsx";
import ComparisonView from "./ComparisonView.jsx";
import { useDashboardStore } from "../store/dashboardStore";

export default function TestMap() {
  const viewMode = useDashboardStore((s) => s.filters.viewMode ?? "choropleth");
  const setFilter = useDashboardStore((s) => s.setFilter);
  const topN = useDashboardStore((s) => s.filters.topN ?? 200);
  const enableTopN = useDashboardStore((s) => s.filters.enableTopN ?? true);

  // If in comparison mode, show the comparison view
  if (viewMode === "comparison") {
    return <ComparisonView />;
  }

  const isFlowView = viewMode === "flow";
  const mapTitle = isFlowView ? "Flow View" : "Choropleth View";
  const mapComponent = isFlowView ? <MigrationFlowMap /> : <ChoroplethMap />;
  const legendLayout = isFlowView ? "flow" : "choropleth";

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Left Sidebar - Filters + Legend */}
      <div
        style={{
          width: 300,
          flexShrink: 0,
          padding: "16px",
          overflowY: "auto",
          background: "#f9fafb",
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <FilterPanel />

        {/* Top N Selector for Flow View */}
        {isFlowView && (
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: "16px",
              border: "1px solid #e2e8f0",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 13,
                fontWeight: 600,
                color: "#4b5563",
                fontFamily: "Monaco, monospace",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={enableTopN}
                onChange={(e) => {
                  setFilter("enableTopN", e.target.checked);
                  if (e.target.checked) {
                    setFilter("topN", 10); // Set to 10 when enabled
                  }
                }}
                style={{ marginRight: 8 }}
              />
              Show Top 10 Destinations
            </label>
          </div>
        )}

        <LegendPanel layout={legendLayout} />
      </div>

      {/* Main Map Area - Reduced width by 15% */}
      <div
        style={{
          width: isFlowView ? "58%" : "auto",
          flex: isFlowView ? "0 0 58%" : 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <h2
          style={{
            margin: "16px 0 0 0",
            padding: "0 16px",
            fontSize: 18,
            fontWeight: 600,
            color: "#1f2937",
          }}
        >
          {mapTitle}
        </h2>
        <div style={{ flex: 1, position: "relative" }}>{mapComponent}</div>
      </div>

      {/* Right Sidebar - Top Destinations Bar Chart + SHAP */}
      <div
        style={{
          width: isFlowView ? "calc(42% - 300px)" : 360,
          flexShrink: 0,
          padding: "16px",
          overflowY: "auto",
          background: "#f9fafb",
          borderLeft: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Summary Panel (for choropleth) */}
        {!isFlowView && <SummaryPanel />}

        {/* Top Destinations Panel (for flow view) */}
        {isFlowView && <TopDestinationsPanel />}

        {/* SHAP Panel (shown when arc is clicked) */}
        {isFlowView && <ShapPanel />}
      </div>
    </div>
  );
}
