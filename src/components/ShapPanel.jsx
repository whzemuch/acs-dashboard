import { useEffect, useMemo, useState } from "react";
import { useDashboardStore } from "../store/dashboardStore";
import { getShapForState, getShapSchema } from "../data/dataProviderShap";
import CoeffChart from "./CoeffChart";

export default function ShapPanel({ side = null }) {
  // Use different selectedArc and filters based on side (for comparison view)
  const mainSelectedArc = useDashboardStore((s) => s.selectedArc);
  const leftSelectedArc = useDashboardStore((s) => s.leftSelectedArc);
  const rightSelectedArc = useDashboardStore((s) => s.rightSelectedArc);
  const arc =
    side === "left"
      ? leftSelectedArc
      : side === "right"
      ? rightSelectedArc
      : mainSelectedArc;

  const mainFilters = useDashboardStore((s) => s.filters);
  const leftFilters = useDashboardStore((s) => s.leftFilters);
  const rightFilters = useDashboardStore((s) => s.rightFilters);
  const filters =
    side === "left"
      ? leftFilters
      : side === "right"
      ? rightFilters
      : mainFilters;

  const viewMode = filters.viewMode ?? "flow";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [entry, setEntry] = useState(null);
  const [topK, setTopK] = useState(10);
  const [absSort, setAbsSort] = useState(true);
  const [chartWidth, setChartWidth] = useState(480);
  const containerId = side
    ? `shap-panel-chart-container-${side}`
    : "shap-panel-chart-container";

  const stateCode = useMemo(
    () => (arc?.dest ? arc.dest.slice(0, 2) : null),
    [arc]
  );

  useEffect(() => {
    let cancelled = false;
    setEntry(null);
    setError(null);
    if (!arc || !stateCode) return;
    setLoading(true);
    (async () => {
      try {
        const payload = await getShapForState(stateCode);
        const found = payload?.rows?.find((r) => r.id === arc.id) || null;
        if (!cancelled) setEntry(found);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [arc, stateCode]);

  const schema = getShapSchema();

  const topStats = useMemo(() => {
    if (!entry) return null;
    const rows = shapToRows(entry.shapValues, schema);
    rows.sort((a, b) =>
      absSort ? Math.abs(b.value) - Math.abs(a.value) : b.value - a.value
    );
    const sliced = rows.slice(
      0,
      Math.max(1, Math.min(100, Number(topK) || 10))
    );
    return rowsToStats(sliced);
  }, [entry, schema, topK, absSort]);

  // Measure available width for the chart
  useEffect(() => {
    function measure() {
      const el = document.getElementById(containerId);
      if (!el) return;
      const total = el.clientWidth || 720;
      // Use most of the available width with some padding
      const w = Math.max(360, total - 40);
      setChartWidth(w);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [containerId]);

  // Hide SHAP panel in Choropleth view or when no arc selected
  // In comparison mode (when side is provided), always show SHAP panels (they handle empty state)
  const isComparisonMode = side !== null;

  if (!isComparisonMode && (viewMode === "choropleth" || !arc)) return null;

  // In comparison mode, show empty state if no arc selected
  if (isComparisonMode && !arc) {
    return (
      <div
        style={{
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "100%",
        }}
      >
        <h3
          style={{ margin: 0, fontSize: 18, fontFamily: "Monaco, monospace" }}
        >
          SHAP Contributions
        </h3>
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            fontFamily: "Monaco, monospace",
          }}
        >
          Click an arc above or a bar on the left to explore the feature
          contributions
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18, fontFamily: "Monaco, monospace" }}>
        SHAP Contributions
      </h3>
      {loading ? (
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            fontFamily: "Monaco, monospace",
          }}
        >
          Loading SHAP…
        </div>
      ) : error ? (
        <div
          style={{
            color: "#b91c1c",
            fontSize: 13,
            fontFamily: "Monaco, monospace",
          }}
        >
          Failed to load SHAP. {error}
        </div>
      ) : entry ? (
        <div
          id={containerId}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220, fontFamily: "Monaco, monospace" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{arc.id}</div>
              <div style={{ fontSize: 12, color: "#4b5563" }}>
                Observed: {arc.observed?.toLocaleString?.()}
              </div>
              <div style={{ fontSize: 12, color: "#4b5563" }}>
                Predicted:{" "}
                {arc.predicted?.toLocaleString?.(undefined, {
                  maximumFractionDigits: 1,
                })}
              </div>
              <div style={{ fontSize: 12, color: "#4b5563" }}>
                Base: {Number(entry.shapBase).toFixed(2)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontFamily: "Monaco, monospace",
              }}
            >
              <label style={{ fontSize: 12, color: "#4b5563" }}>
                Top K SHAP (1–100)
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={topK}
                  onChange={(e) => setTopK(e.target.value)}
                  style={{
                    marginLeft: 8,
                    width: 72,
                    fontFamily: "Monaco, monospace",
                  }}
                />
              </label>
              <label style={{ fontSize: 12, color: "#4b5563" }}>
                <input
                  type="checkbox"
                  checked={absSort}
                  onChange={(e) => setAbsSort(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Sort by absolute value
              </label>
              <button
                type="button"
                onClick={() => copyShapCsv(entry, schema, setCopiedToast)}
                style={{ fontSize: 12, fontFamily: "Monaco, monospace" }}
              >
                Copy SHAP as CSV
              </button>
            </div>
          </div>

          <CoeffChart
            stats={topStats || arrayShapToObject(entry.shapValues, schema)}
            width={chartWidth}
            height={300}
            mode="coefficients"
          />
        </div>
      ) : (
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            fontFamily: "Monaco, monospace",
          }}
        >
          No SHAP entry found for this arc.
        </div>
      )}
      <CopyToast />
    </div>
  );
}

// Convert shapValues[] into object keyed by feature names for CoeffChart
function arrayShapToObject(values, schema) {
  const obj = {};
  const names = Array.isArray(schema) && schema.length ? schema : [];
  (values || []).forEach((v, i) => {
    const key = names[i] || `shap_${i}`;
    obj[prettifyKey(key)] = v;
  });
  return obj;
}

function prettifyKey(key) {
  // Remove leading 'shap_' and convert snake_case to Title Case
  const k = String(key).replace(/^shap_/, "");
  return k
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function shapToRows(values, schema) {
  const names = Array.isArray(schema) && schema.length ? schema : [];
  return (values || []).map((v, i) => ({
    label: prettifyKey(names[i] || `shap_${i}`),
    value: Number(v) || 0,
  }));
}

function rowsToStats(rows) {
  const obj = {};
  rows.forEach(({ label, value }) => (obj[label] = value));
  return obj;
}

let __setToast;
function CopyToast() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    __setToast = (flag) => {
      setVisible(flag);
      if (flag) setTimeout(() => setVisible(false), 1500);
    };
    return () => {
      __setToast = undefined;
    };
  }, []);
  if (!visible) return null;
  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        bottom: 16,
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "8px 12px",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "Monaco, monospace",
      }}
    >
      Copied to clipboard
    </div>
  );
}

function setCopiedToast(flag) {
  if (typeof __setToast === "function") __setToast(flag);
}

async function copyShapCsv(entry, schema, setToast) {
  const rows = shapToRows(entry.shapValues, schema);
  const lines = [
    "feature,value",
    ...rows.map((r) => `${escapeCsv(r.label)},${r.value}`),
  ];
  const csv = lines.join("\n");
  try {
    await navigator.clipboard.writeText(csv);
    setToast?.(true);
    setTimeout(() => setToast?.(false), 1200);
  } catch {
    // Fallback: trigger a CSV download if clipboard not available
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shap_contributions.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast?.(true);
      setTimeout(() => setToast?.(false), 1200);
    } catch (e) {
      // Last resort: textarea copy attempt
      const ta = document.createElement("textarea");
      ta.value = csv;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setToast?.(true);
      setTimeout(() => setToast?.(false), 1200);
    }
  }
}

function escapeCsv(s) {
  const need = /[",\n]/.test(String(s));
  const val = String(s).replace(/"/g, '""');
  return need ? `"${val}"` : val;
}
