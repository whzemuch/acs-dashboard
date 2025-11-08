// src/components/FilterPanel.jsx
import { useEffect, useMemo, useState } from "react";

import { useDashboardStore } from "../store/dashboardStore";

const metricOptions = [
  { id: "in", label: "Inbound" },
  { id: "out", label: "Outbound" },
];

const viewOptions = [
  { id: "flow", label: "Flow" },
  { id: "choropleth", label: "Choropleth" },
];

const valueOptions = [
  { id: "observed", label: "Observed" },
  { id: "predicted", label: "Predicted" },
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

      <ToggleRow
        label="Map View"
        options={viewOptions}
        value={filters.viewMode ?? "choropleth"}
        onSelect={(value) => setFilter("viewMode", value)}
      />

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

      <ToggleRow
        label="Value"
        options={valueOptions}
        value={filters.valueType ?? "observed"}
        onSelect={(value) => setFilter("valueType", value)}
      />

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
        <label style={labelStyle} htmlFor="heatmap-toggle">
          Show heatmap
        </label>
        <input
          id="heatmap-toggle"
          type="checkbox"
          checked={Boolean(filters.showHeatmap)}
          onChange={(e) => setFilter("showHeatmap", e.target.checked)}
        />
      </div>

      {filters.viewMode === "choropleth" && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle} htmlFor="state-net-toggle">
              State net overlay
            </label>
            <input
              id="state-net-toggle"
              type="checkbox"
              checked={Boolean(filters.showStateNetOverlay)}
              onChange={(e) =>
                setFilter("showStateNetOverlay", e.target.checked)
              }
            />
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
        </>
      )}

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

      {/* Only show Min Flow filter in Flow view */}
      {filters.viewMode === "flow" && (
        <div style={sectionStyle}>
          <label style={labelStyle} htmlFor="min-flow">
            Min Flow ({filters.minFlow})
          </label>
          <input
            id="min-flow"
            type="range"
            min={0}
            max={1000}
            step={10}
            value={filters.minFlow ?? 0}
            onChange={(e) => setFilter("minFlow", Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
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
