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
  const filters = useDashboardStore((s) => s.filters);
  const viewMode = filters.viewMode ?? "choropleth";
  const stateFilter = filters.state;
  const setFilter = useDashboardStore((s) => s.setFilter);
  const [flowHelpOpen, setFlowHelpOpen] = useState(false);

  // If in comparison mode, show the comparison view
  if (viewMode === "comparison") {
    return <ComparisonView />;
  }

  const isFlowView = viewMode === "flow";
  const mapTitle = isFlowView ? "Flow View" : "Choropleth View";
  const mapComponent = isFlowView ? <MigrationFlowMap /> : <ChoroplethMap />;
  const legendLayout = isFlowView ? "flow" : "choropleth";

  const userGuide = (
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
        maxWidth: 320,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 15,
          marginBottom: 12,
          color: "#1f2937",
          textAlign: "center",
        }}
      >
        Dashboard Guide
      </div>

      <div style={{ marginBottom: 14 }}>
        <strong>Purpose:</strong> This dashboard helps you explore and analyze
        U.S. state-to-county migration patterns using American Community Survey
        (ACS) data. Compare observed flows with ML predictions and understand
        which demographic and economic features drive migration decisions.
      </div>

      <div style={{ marginBottom: 8, fontWeight: 600, textAlign: "center" }}>
        Three Interactive Views
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "10px 14px",
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 600 }}>Choropleth:</div>
        <div>
          Color-coded county map showing inbound migration intensity. Darker red
          indicates higher migration inflows.
        </div>

        <div style={{ fontWeight: 600 }}>Flow:</div>
        <div>
          Interactive arcs showing origin→destination migration flows with
          SHAP explanations. Toggle "Top 10" for quick rankings.
        </div>

        <div style={{ fontWeight: 600 }}>Comparison:</div>
        <div>
          Side-by-side comparison of two locations with fully independent
          controls.
        </div>
      </div>

      <div style={{ marginBottom: 8, fontWeight: 600, textAlign: "center" }}>
        Interactive Maps
      </div>
      <ul style={{ margin: "0 0 14px 18px", paddingLeft: 0, color: "#4b5563" }}>
        <li>Hover over counties or migration arcs to see detailed information.</li>
        <li>Click a county in Choropleth view to load detailed statistics.</li>
        <li>Click a migration arc in Flow view to explore SHAP feature contributions.</li>
      </ul>

      <div style={{ marginBottom: 8, fontWeight: 600, textAlign: "center" }}>
        Feature Filtering
      </div>
      <ul style={{ margin: "0 0 0 18px", paddingLeft: 0, color: "#4b5563" }}>
        <li>Use the “Feature (state filter)” dropdown to highlight specific drivers.</li>
        <li>See which flows are most influenced by factors like poverty, education, or housing costs.</li>
      </ul>
    </div>
  );

  const rightPanelWidth = 300;
  const rightPanel = (
    <div
      style={{
        width: rightPanelWidth,
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
      {isFlowView ? (
        <>
          <div
            style={{
              background: "white",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setFlowHelpOpen((v) => !v)}
              style={{
                alignSelf: "flex-start",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {flowHelpOpen ? "Hide Flow Tips" : "Show Flow Tips"}
            </button>
            {flowHelpOpen && (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 16,
                  fontSize: 12,
                  color: "#4b5563",
                  lineHeight: 1.6,
                }}
              >
                <li>Use Min Flow + Top 10 toggles to focus on the strongest arcs.</li>
                <li>Click any arc to pin SHAP contributions in the panel below.</li>
                <li>Heatmap overlay highlights destinations with the highest inflow.</li>
              </ul>
            )}
          </div>
          <TopDestinationsPanel />
          <ShapPanel />
        </>
      ) : (
        userGuide
      )}
    </div>
  );

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

        <LegendPanel layout={legendLayout} />
      </div>

      {/* Main Map Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <h2
          style={{
            margin: "16px 0 0 0",
            padding: 0,
            fontSize: 20,
            fontWeight: 600,
            color: "#1f2937",
            textAlign: "center",
          }}
        >
          {mapTitle}
        </h2>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
          }}
        >
          {mapComponent}
          {isFlowView && !stateFilter && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.8)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 24,
                color: "#1f2937",
                fontSize: 15,
                fontWeight: 600,
                gap: 8,
              }}
            >
              <div>Select a state to load flow arcs.</div>
            </div>
          )}
        </div>

        {/* Summary for choropleth */}
        {!isFlowView && (
          <div style={{ padding: "16px" }}>
            <SummaryPanel />
          </div>
        )}
      </div>

      {!isFlowView && rightPanel}
      {isFlowView && rightPanel}
    </div>
  );
}
