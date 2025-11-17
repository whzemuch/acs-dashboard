// src/components/FilterPanel.jsx
import { useEffect, useMemo, useState } from "react";

import { useDashboardStore } from "../store/dashboardStore";

const metricOptions = [
  { id: "in", label: "Inbound" },
  { id: "out", label: "Outbound" },
];

const featureAggOptions = [
  { id: "mean_abs", label: "Mean |SHAP| (importance)" },
  { id: "mean", label: "Signed mean (direction)" },
];

export default function FilterPanel() {
  const init = useDashboardStore((s) => s.init);
  const ready = useDashboardStore((s) => s.ready);
  const filters = useDashboardStore((s) => s.filters);
  const setFilter = useDashboardStore((s) => s.setFilter);
  const resetFilters = useDashboardStore((s) => s.resetFilters);
  const years = useDashboardStore((s) => s.availableYears);
  const states = useDashboardStore((s) => s.states);
  const countiesByState = useDashboardStore((s) => s.countiesByState);

  useEffect(() => {
    init();
  }, [init]);

  // Feature rank list (Top K)
  const [featureRank, setFeatureRank] = useState([]);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  useEffect(() => {
    (async () => {
      if (!ready) return;
      try {
        const mod = await import("../data/dataProviderShap");
        const rank = await mod.getFeatureGlobalRank();
        setFeatureRank(rank || []);
      } catch {}
    })();
  }, [ready]);

  // If a county is selected, only 'in' metric is meaningful for state→county dataset
  const metricOptionsFinal = filters.county
    ? metricOptions.filter((m) => m.id === "in")
    : metricOptions;

  // Enforce 'in' when a county is active
  useEffect(() => {
    if (filters.county && filters.metric !== "in") {
      setFilter("metric", "in");
    }
  }, [filters.county]);

  if (!ready) {
    return (
      <div style={panelStyle}>
        <div style={sectionStyle}>Loading filters…</div>
      </div>
    );
  }

  const selectedState = filters.state;
  const countyOptions = selectedState
    ? countiesByState[selectedState] ?? []
    : [];

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>Filters</span>
        <button type="button" onClick={resetFilters} style={linkButton}>
          Reset
        </button>
      </div>

      <div style={mapViewCardStyle}>
        <span style={{ ...labelStyle, marginBottom: 6 }}>Map View</span>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {["choropleth", "flow"].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilter("viewMode", mode)}
              style={
                (filters.viewMode ?? "choropleth") === mode
                  ? toggleButtonActive
                  : toggleButton
              }
            >
              {mode === "choropleth" ? "Choropleth" : "Flow"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setFilter("viewMode", "comparison")}
            style={
              (filters.viewMode ?? "choropleth") === "comparison"
                ? toggleButtonActive
                : toggleButton
            }
          >
            Comparison
          </button>
        </div>
      </div>

      {/* Year selector removed for SHAP dataset (no year) */}

      {/* Only show Metric selector in Flow view */}
      {filters.viewMode === "flow" && (
        <ToggleRow
          label="Metric"
          options={metricOptionsFinal}
          value={filters.metric ?? "in"}
          onSelect={(value) => setFilter("metric", value)}
        />
      )}

      <div style={sectionStyle}>
        <label style={labelStyle} htmlFor="state-select">
          State
        </label>
        <select
          id="state-select"
          value={filters.state ?? ""}
          onChange={(e) =>
            setFilter("state", e.target.value ? e.target.value : null)
          }
          style={selectStyle}
        >
          <option value="">All States</option>
          {states.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle} htmlFor="county-select">
          County
        </label>
        <select
          id="county-select"
          value={filters.county ?? ""}
          onChange={(e) =>
            setFilter("county", e.target.value ? e.target.value : null)
          }
          style={selectStyle}
          disabled={!selectedState || countyOptions.length === 0}
        >
          <option value="">
            {selectedState ? "All Counties" : "Select state first"}
          </option>
          {countyOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {filters.viewMode === "flow" && (
        <div style={sectionStyle}>
          <label style={labelStyle} htmlFor="min-flow">
            Min Flow ({filters.minFlow})
          </label>
          <input
            id="min-flow"
            type="range"
            min={0}
            max={100000}
            step={500}
            value={filters.minFlow ?? 0}
            onChange={(e) => setFilter("minFlow", Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Feature impact on Flow (state-scoped) */}
      {filters.viewMode === "flow" && filters.state && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle} htmlFor="flow-feature-select">
              Feature (state filter)
            </label>
            <select
              id="flow-feature-select"
              value={filters.featureId ?? ""}
              onChange={(e) => setFilter("featureId", e.target.value || null)}
              style={selectStyle}
            >
              <option value="">All features</option>
              {(showAllFeatures
                ? featureRank || []
                : (featureRank || []).slice(
                    0,
                    Math.max(1, filters.featureTopK ?? 12)
                  )
              ).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 12, color: "#4b5563", marginTop: 6 }}>
              <input
                type="checkbox"
                checked={showAllFeatures}
                onChange={(e) => setShowAllFeatures(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Show all features (instead of top {filters.featureTopK ?? 12})
            </label>
          </div>
          {filters.featureId && (
            <div style={sectionStyle}>
              <label style={labelStyle} htmlFor="flow-feature-quantile">
                Min impact strength (percentile) (
                {Math.round(filters.featureFlowQuantile ?? 0)}%)
              </label>
              <input
                id="flow-feature-quantile"
                type="range"
                min={0}
                max={100}
                step={5}
                value={filters.featureFlowQuantile ?? 0}
                onChange={(e) =>
                  setFilter("featureFlowQuantile", Number(e.target.value))
                }
                style={{ width: "100%" }}
              />
            </div>
          )}
        </>
      )}

      {filters.viewMode === "flow" && (
        <div style={sectionStyle}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={Boolean(filters.enableTopN ?? true)}
              onChange={(e) => {
                setFilter("enableTopN", e.target.checked);
                if (e.target.checked) {
                  setFilter("topN", 10);
                }
              }}
              style={{ marginRight: 8 }}
            />
            Show Top 10 Flows
          </label>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={Boolean(filters.showHeatmap)}
              onChange={(e) => setFilter("showHeatmap", e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Show heatmap
          </label>
        </div>
      )}

      {filters.viewMode === "flow" && (
        <div style={infoCardStyle}>
          <div style={infoCardTitle}>Glossary</div>
          <ul style={glossaryListStyle}>
            <li>
              <strong>Inbound:</strong> Flows coming into the selected region.
            </li>
            <li>
              <strong>Outbound:</strong> Flows leaving the selected region.
            </li>
            <li>
              <strong>Observed:</strong> ACS 2023 5-year migration counts.
            </li>
            <li>
              <strong>Predicted:</strong> Model estimates from demographic
              inputs.
            </li>
            <li>
              <strong>SHAP:</strong> Feature importance explaining each flow.
            </li>
          </ul>
        </div>
      )}

      {filters.viewMode === "feature" && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle} htmlFor="feature-select">
              Feature
            </label>
            <select
              id="feature-select"
              value={filters.featureId ?? ""}
              onChange={(e) => setFilter("featureId", e.target.value || null)}
              style={selectStyle}
            >
              <option value="">Select a feature…</option>
              {(featureRank || [])
                .slice(0, Math.max(1, filters.featureTopK ?? 12))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
            </select>
            <small style={{ color: "#6b7280" }}>
              Top {filters.featureTopK ?? 12} by mean |SHAP|
            </small>
          </div>
          <ToggleRow
            label="Aggregation"
            options={featureAggOptions}
            value={filters.featureAgg ?? "mean_abs"}
            onSelect={(value) => setFilter("featureAgg", value)}
          />
        </>
      )}

      {filters.viewMode === "choropleth" && (
        <>
          <div style={sectionStyle}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={Boolean(filters.showStateNetOverlay)}
                onChange={(e) =>
                  setFilter("showStateNetOverlay", e.target.checked)
                }
                style={{ marginRight: 8 }}
              />
              State net overlay
            </label>
          </div>
          {filters.showStateNetOverlay && (
            <div style={sectionStyle}>
              <label style={labelStyle} htmlFor="state-net-opacity">
                State net overlay opacity (
                {Math.round((filters.stateNetOpacity ?? 0.6) * 100)}%)
              </label>
              <input
                id="state-net-opacity"
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={filters.stateNetOpacity ?? 0.6}
                onChange={(e) =>
                  setFilter("stateNetOpacity", Number(e.target.value))
                }
                style={{ width: "100%" }}
              />
            </div>
          )}
          <div style={infoCardStyle}>
            <div style={infoCardTitle}>Getting Started</div>
            <ul style={gettingStartedListStyle}>
              <li>Select a state from the dropdown to focus on a region.</li>
              <li>Choose a county to see detailed migration statistics.</li>
              <li>
                Switch between Choropleth, Flow, and Comparison views using the
                buttons above.
              </li>
              <li>
                In Flow view, enable "Top 10" to see origin/destination bar
                charts.
              </li>
              <li>
                Click on migration arcs to reveal SHAP feature importance.
              </li>
              <li>Hover over counties or arcs for quick summary tooltips.</li>
            </ul>
          </div>
        </>
      )}

      {/* Age/Income/Education filters removed for SHAP dataset */}
    </div>
  );
}

function buildOptions(items) {
  return [
    { id: "all", label: "All" },
    ...items.map((item) => ({
      id: item.id,
      label: item.label,
    })),
  ];
}

const panelStyle = {
  width: "260px",
  minWidth: "220px",
  background: "#f9fafc",
  border: "1px solid #e0e3eb",
  borderRadius: "10px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const sectionStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelStyle = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#1f2933",
};

const selectStyle = {
  padding: "6px 8px",
  borderRadius: "6px",
  border: "1px solid #cbd2d9",
  fontSize: "13px",
};

const toggleGroupStyle = {
  display: "flex",
  gap: "6px",
};

const baseToggle = {
  flex: 1,
  padding: "6px 8px",
  borderRadius: "6px",
  fontSize: "13px",
  cursor: "pointer",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#cbd2d9",
  background: "white",
};

const toggleButton = {
  ...baseToggle,
};

const toggleButtonActive = {
  ...baseToggle,
  background: "#2563eb",
  color: "white",
  borderColor: "#1d4ed8",
};

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  fontSize: "13px",
  fontWeight: 600,
  color: "#4b5563",
  cursor: "pointer",
};

const mapViewCardStyle = {
  background: "white",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const infoCardStyle = {
  background: "white",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  padding: "14px",
  fontSize: 12,
  color: "#4b5563",
  lineHeight: 1.6,
};

const infoCardTitle = {
  fontWeight: 600,
  fontSize: 13,
  color: "#111827",
  marginBottom: 6,
};

const glossaryListStyle = {
  margin: 0,
  paddingLeft: 18,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const gettingStartedListStyle = {
  margin: 0,
  paddingLeft: 18,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontWeight: 600,
  color: "#111827",
};

const linkButton = {
  background: "none",
  border: "none",
  color: "#2563eb",
  cursor: "pointer",
  fontSize: "12px",
  padding: 0,
};

function ToggleRow({ label, options, value, onSelect }) {
  return (
    <div style={sectionStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={toggleGroupStyle}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            style={value === option.id ? toggleButtonActive : toggleButton}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
