// src/views/ChoroplethPage.jsx
import FilterPanel from "../components/FilterPanel";
import LegendPanel from "../components/LegendPanel";
import ChoroplethMap from "../components/ChoroplethMap";
import MigrationFlowMap from "../components/MigrationFlowMap";
import TrendPanel from "../components/TrendPanel";
import { useDashboardStore } from "../store/dashboardStore";

export default function ChoroplethPage() {
  const viewMode = useDashboardStore((s) => s.filters.viewMode ?? "choropleth");

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
        <LegendPanel layout="stack" />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 600,
          maxWidth: "70vw",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          overflowY: "auto",
          maxHeight: "calc(100vh - 32px)",
        }}
      >
        <div style={{ minHeight: "55vh", maxHeight: "55vh", flexShrink: 0 }}>
          {viewMode === "flow" ? <MigrationFlowMap /> : <ChoroplethMap />}
        </div>
        <TrendPanel />

        {/* TEST - Should be visible when you scroll */}
        <div
          style={{
            background: "red",
            color: "white",
            padding: "20px",
            fontSize: "20px",
            fontWeight: "bold",
          }}
        >
          🔴 SCROLL TEST - Can you see this?
        </div>

        {/* User Guide */}
        <div
          style={{
            background: "white",
            borderRadius: 10,
            padding: "16px 20px",
            border: "1px solid #e2e8f0",
            fontSize: 13,
            lineHeight: 1.6,
            color: "#374151",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 12,
              color: "#1f2937",
            }}
          >
            📖 Dashboard Guide
          </div>

          <div style={{ marginBottom: 12 }}>
            <strong>Purpose:</strong> Explore U.S. state to county-level
            migration patterns using ACS data. Compare observed data with ML
            predictions.
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Three Views:</strong>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "8px 12px",
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 600 }}>🗺️ Choropleth:</div>
            <div>
              Color-coded map showing inbound migration by county. Identify
              hotspots and regional patterns.
            </div>

            <div style={{ fontWeight: 600 }}>🔀 Flow:</div>
            <div>
              Interactive arcs showing origin→destination flows. Toggle "Top 10"
              for bar charts and SHAP explanations.
            </div>

            <div style={{ fontWeight: 600 }}>⚖️ Comparison:</div>
            <div>
              Side-by-side view with independent controls. Compare two counties
              (e.g., urban vs rural).
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Quick Start:</strong>
          </div>
          <ul style={{ margin: "0 0 12px 20px", paddingLeft: 0 }}>
            <li>Select state and county to explore</li>
            <li>Switch views using buttons at top</li>
            <li>In Flow: Toggle "Top 10" for detailed charts</li>
          </ul>

          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              borderTop: "1px solid #e5e7eb",
              paddingTop: 8,
            }}
          >
            <strong>Data:</strong> "Observed" = ACS survey data | "Predicted" =
            ML model | SHAP = feature explanations
          </div>
        </div>
      </div>
    </div>
  );
}
