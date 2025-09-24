import { useEffect, useMemo, useState } from "react";

import { useDashboardStore } from "../store/dashboardStore";
import { getCountyMetadata, getYearSummary } from "../data/dataProvider";

const cardStyle = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const valueRow = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 13,
};

export default function SelectedCountySummary() {
  const ready = useDashboardStore((s) => s.ready);
  const filters = useDashboardStore((s) => s.filters);
  const selectedCounty = useDashboardStore((s) => s.selectedCounty);

  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getYearSummary(filters.year);
        if (!cancelled) setSummary(data);
      } catch (error) {
        console.error("Failed to load summary", error);
        if (!cancelled) setSummary(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, filters.year]);

  const countyLookup = useMemo(() => {
    const map = new Map();
    getCountyMetadata().forEach((entry) => map.set(entry.geoid, entry));
    return map;
  }, []);

  if (!selectedCounty) {
    return (
      <div style={cardStyle}>
        <strong style={{ fontSize: 14 }}>Selected County</strong>
        <span style={{ fontSize: 13, color: "#4a5568" }}>
          Double-click a county on the map to focus its flows and stats.
        </span>
      </div>
    );
  }

  const inboundTotals = summary?.inboundTotals ?? {};
  const outboundTotals = summary?.outboundTotals ?? {};
  const inbound = inboundTotals[selectedCounty] ?? 0;
  const outbound = outboundTotals[selectedCounty] ?? 0;
  const net = inbound - outbound;
  const meta = countyLookup.get(selectedCounty);

  return (
    <div style={cardStyle}>
      <strong style={{ fontSize: 14 }}>Selected County</strong>
      <div style={{ fontSize: 13 }}>
        {meta ? `${meta.name}, ${meta.stateName}` : selectedCounty}
      </div>
      <div style={valueRow}>
        <span>Inbound</span>
        <span>{formatNumber(inbound)}</span>
      </div>
      <div style={valueRow}>
        <span>Outbound</span>
        <span>{formatNumber(outbound)}</span>
      </div>
      <div style={{ ...valueRow, fontWeight: 600 }}>
        <span>Net</span>
        <span>{formatNumber(net)}</span>
      </div>
      <div style={{ fontSize: 12, color: "#4a5568" }}>
        {filters.age !== "all" && <span>Age: {filters.age} </span>}
        {filters.income !== "all" && <span>Income: {filters.income} </span>}
        {filters.education !== "all" && (
          <span>Education: {filters.education}</span>
        )}
      </div>
    </div>
  );
}

function formatNumber(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
