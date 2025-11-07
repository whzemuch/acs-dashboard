import { useEffect, useMemo, useState } from "react";
import { useDashboardStore } from "../store/dashboardStore";
import { getSummary, getCountyMetadata } from "../data/dataProviderShap";

export default function SummaryPanel() {
  const ready = useDashboardStore((s) => s.ready);
  const filters = useDashboardStore((s) => s.filters);
  const [summary, setSummary] = useState(null);

  const countyLookup = useMemo(() => {
    const map = new Map();
    getCountyMetadata().forEach((m) => map.set(m.geoid, m));
    return map;
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const s = getSummary();
    setSummary(s);
  }, [ready]);

  const data = useMemo(() => buildSummary(summary, filters), [summary, filters]);

  const label = useMemo(() => {
    if (filters.county) {
      const meta = countyLookup.get(filters.county);
      return meta ? `${meta.name}, ${meta.stateName ?? meta.state}` : filters.county;
    }
    if (filters.state) return `State ${filters.state}`;
    return "United States";
  }, [filters.county, filters.state, countyLookup]);

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: "100%",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Summary</h3>
        <div style={{ fontSize: 13, color: "#4b5563" }}>{label}</div>
      </div>

      {!summary ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
          <Stat label="Inbound (Obs)" value={data.inboundObs} />
          <Stat label="Inbound (Pred)" value={data.inboundPred} />
          {data.scope !== "county" && (
            <>
              <Stat label="Outbound (Obs)" value={data.outboundObs} />
              <Stat label="Outbound (Pred)" value={data.outboundPred} />
              <Stat label="Net (Obs)" value={data.netObs} />
              <Stat label="Net (Pred)" value={data.netPred} />
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
  const stateCode = filters.state || (filters.county ? filters.county.slice(0, 2) : null);

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
    const inboundObs = summary.inboundTotalsByStateObserved?.[stateCode] ?? 0;
    const inboundPred = summary.inboundTotalsByStatePredicted?.[stateCode] ?? 0;
    const outboundObs = summary.outboundTotalsByStateObserved?.[stateCode] ?? 0;
    const outboundPred = summary.outboundTotalsByStatePredicted?.[stateCode] ?? 0;
    return {
      scope: "state",
      inboundObs,
      inboundPred,
      outboundObs,
      outboundPred,
      netObs: inboundObs - outboundObs,
      netPred: inboundPred - outboundPred,
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
    netObs: inboundObs - outboundObs,
    netPred: inboundPred - outboundPred,
  };
}

