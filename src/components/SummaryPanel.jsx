import { useEffect, useMemo, useState } from "react";
import { useDashboardStore } from "../store/dashboardStore";
import { getSummary, getCountyMetadata } from "../data/dataProviderShap";

export default function SummaryPanel({ side = null }) {
  const ready = useDashboardStore((s) => s.ready);

  // Use different filters based on side (for comparison view)
  const mainFilters = useDashboardStore((s) => s.filters);
  const leftFilters = useDashboardStore((s) => s.leftFilters);
  const rightFilters = useDashboardStore((s) => s.rightFilters);
  const filters =
    side === "left"
      ? leftFilters
      : side === "right"
      ? rightFilters
      : mainFilters;

  const states = useDashboardStore((s) => s.states);
  const [summary, setSummary] = useState(null);

  const countyLookup = useMemo(() => {
    const map = new Map();
    getCountyMetadata().forEach((m) => map.set(m.geoid, m));
    return map;
  }, [ready]);

  const stateNameMap = useMemo(() => {
    const map = new Map();
    states.forEach((s) => map.set(s.id, s.label));
    return map;
  }, [states]);

  useEffect(() => {
    if (!ready) return;
    const s = getSummary();
    setSummary(s);
  }, [ready]);

  const data = useMemo(
    () => buildSummary(summary, filters),
    [summary, filters]
  );

  const label = useMemo(() => {
    if (filters.county) {
      const meta = countyLookup.get(filters.county);
      return meta
        ? `for county ${meta.name}, ${meta.stateName ?? meta.state}`
        : `for county ${filters.county}`;
    }
    if (filters.state) {
      const stateName = stateNameMap.get(filters.state);
      return `for state ${stateName || filters.state}`;
    }
    return "for United States";
  }, [filters.county, filters.state, countyLookup, stateNameMap]);

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 100,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}
      >
        <h3 style={{ margin: 0, fontSize: 16, whiteSpace: "nowrap" }}>
          Summary
        </h3>
        <div
          style={{
            fontSize: 13,
            color: "#4b5563",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </div>

      {!summary ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading…</div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 16,
          }}
        >
          <Stat label="Inbound (Obs)" value={data.inboundObs} />
          <Stat label="Inbound (Pred)" value={data.inboundPred} />
          {data.scope !== "county" && (
            <>
              <Stat label="Outbound (Obs)" value={data.outboundObs} />
              <Stat label="Outbound (Pred)" value={data.outboundPred} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  const display = Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "–";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{display}</div>
    </div>
  );
}

function buildSummary(summary, filters) {
  if (!summary) return {};

  // Extract 2-digit state code for summary lookups
  // filters.state is 3-digit ("006"), summary data uses 2-digit ("06")
  const stateCode = filters.state
    ? filters.state.slice(-2)
    : filters.county
    ? filters.county.slice(0, 2)
    : null;

  // County scope: only inbound is defined for county (state→county dataset)
  if (filters.county) {
    const county = filters.county;
    const inboundObs = summary.inboundTotalsByCountyObserved?.[county] ?? 0;
    const inboundPred = summary.inboundTotalsByCountyPredicted?.[county] ?? 0;
    return {
      scope: "county",
      inboundObs,
      inboundPred,
    };
  }

  // State scope: inbound/outbound available
  if (stateCode) {
    // Inbound totals use 2-digit state codes (destination)
    const inboundObs = summary.inboundTotalsByStateObserved?.[stateCode] ?? 0;
    const inboundPred = summary.inboundTotalsByStatePredicted?.[stateCode] ?? 0;

    // Outbound totals use 3-digit state codes (origin format)
    const stateCode3Digit = stateCode.padStart(3, "0");
    const outboundObs =
      summary.outboundTotalsByStateObserved?.[stateCode3Digit] ?? 0;
    const outboundPred =
      summary.outboundTotalsByStatePredicted?.[stateCode3Digit] ?? 0;

    return {
      scope: "state",
      inboundObs,
      inboundPred,
      outboundObs,
      outboundPred,
    };
  }

  // National: sum across states
  const sum = (obj = {}) => Object.values(obj).reduce((a, b) => a + b, 0);
  const inboundObs = sum(summary.inboundTotalsByStateObserved);
  const inboundPred = sum(summary.inboundTotalsByStatePredicted);
  const outboundObs = sum(summary.outboundTotalsByStateObserved);
  const outboundPred = sum(summary.outboundTotalsByStatePredicted);
  return {
    scope: "national",
    inboundObs,
    inboundPred,
    outboundObs,
    outboundPred,
  };
}
