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
                cursor: "pointer",
              }}
              className="font-mono"
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
          overflowY: !isFlowView ? "auto" : "visible",
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
        <div
          style={{
            flex: isFlowView ? 1 : "0 0 auto",
            minHeight: isFlowView ? 0 : "calc(100vh - 250px)",
            maxHeight: isFlowView ? "none" : "calc(100vh - 250px)",
            position: "relative",
          }}
        >
          {mapComponent}
        </div>

        {/* Summary Panel (for choropleth) - below map */}
        {!isFlowView && (
          <div style={{ padding: "16px" }}>
            <SummaryPanel />
          </div>
        )}
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
        {/* Summary Panel removed from here - now below map */}

        {/* Top Destinations Panel (for flow view) */}
        {isFlowView && <TopDestinationsPanel />}

        {/* SHAP Panel (shown when arc is clicked) */}
        {isFlowView && <ShapPanel />}

        {/* User Guide - only show in choropleth view */}
        {!isFlowView && (
          <div
            id="user-guide-panel"
            style={{
              background: "white",
              borderRadius: 10,
              padding: "16px 20px",
              border: "1px solid #e2e8f0",
              fontSize: 13,
              lineHeight: 1.7,
              color: "#374151",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                marginBottom: 12,
                color: "#1f2937",
              }}
            >
              📖 Dashboard Guide
            </div>

            <div style={{ marginBottom: 14 }}>
              <strong>Purpose:</strong> This dashboard helps you explore and
              analyze U.S. state-to-county migration patterns using American
              Community Survey (ACS) data. Compare actual observed migration
              flows with machine learning model predictions, and understand
              which demographic and economic features drive migration decisions.
            </div>

            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              Three Interactive Views:
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "10px 14px",
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 600 }}>🗺️ Choropleth:</div>
              <div>
                Color-coded county map showing inbound migration intensity.
                Darker red indicates higher migration inflows. Great for quickly
                identifying regional hotspots and migration destinations across
                the entire U.S.
              </div>

              <div style={{ fontWeight: 600 }}>🔀 Flow:</div>
              <div>
                Interactive arc map displaying origin→destination migration
                flows. Click on arcs to see detailed SHAP feature explanations
                showing which demographic factors (age, income, education,
                housing costs) influenced that specific migration pattern.
                Toggle "Top 10" to see bar charts of top origins/destinations.
              </div>

              <div style={{ fontWeight: 600 }}>⚖️ Comparison:</div>
              <div>
                Side-by-side comparison of two locations with fully independent
                controls. Perfect for comparing urban vs. rural, coastal vs.
                inland, or any two counties to understand what drives different
                migration outcomes.
              </div>
            </div>

            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              Getting Started:
            </div>
            <ul style={{ margin: "0 0 14px 20px", paddingLeft: 0 }}>
              <li style={{ marginBottom: 4 }}>
                Select a state from the dropdown to focus on a specific region
              </li>
              <li style={{ marginBottom: 4 }}>
                Choose a county to see detailed migration statistics
              </li>
              <li style={{ marginBottom: 4 }}>
                Switch between Choropleth, Flow, and Comparison views using
                buttons
              </li>
              <li style={{ marginBottom: 4 }}>
                In Flow view: Enable "Top 10" to see origin/destination bar
                charts
              </li>
              <li style={{ marginBottom: 4 }}>
                Click on migration arcs to reveal SHAP feature importance
              </li>
              <li>Hover over counties or arcs for quick summary tooltips</li>
            </ul>

            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                borderTop: "1px solid #e5e7eb",
                paddingTop: 10,
                marginTop: 4,
              }}
            >
              <strong>Understanding the Data:</strong>
              <br />
              <strong>Observed</strong> = Actual ACS survey migration data
              (2023, 5-year estimates)
              <br />
              <strong>Predicted</strong> = Machine learning model predictions
              based on demographic features
              <br />
              <strong>SHAP values</strong> = Feature importance scores
              explaining which demographic/economic factors influenced specific
              migration flows
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
