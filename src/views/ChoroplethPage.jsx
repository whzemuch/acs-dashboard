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
        }}
      >
        <div style={{ flex: 1, minHeight: "55vh" }}>
          {viewMode === "flow" ? <MigrationFlowMap /> : <ChoroplethMap />}
        </div>
        <TrendPanel />
      </div>
    </div>
  );
}
