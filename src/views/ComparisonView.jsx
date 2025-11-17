// src/views/ComparisonView.jsx
import React, { useEffect, useState } from "react";
import { useDashboardStore } from "../store/dashboardStore";
import MigrationFlowMap from "../components/MigrationFlowMap";
import ChoroplethMap from "../components/ChoroplethMap";
import SummaryPanel from "../components/SummaryPanel";
import ShapPanel from "../components/ShapPanel";
import TopDestinationsPanel from "../components/TopDestinationsPanel";

export default function ComparisonView() {
  const ready = useDashboardStore((s) => s.ready);
  const leftFilters = useDashboardStore((s) => s.leftFilters);
  const rightFilters = useDashboardStore((s) => s.rightFilters);
  const states = useDashboardStore((s) => s.states);
  const countiesByState = useDashboardStore((s) => s.countiesByState);
  const setLeftFilter = useDashboardStore((s) => s.setLeftFilter);
  const setRightFilter = useDashboardStore((s) => s.setRightFilter);
  const syncSharedFilters = useDashboardStore((s) => s.syncSharedFilters);
  const setFilter = useDashboardStore((s) => s.setFilter);

  // Local state for comparison view type (flow or choropleth)
  const [comparisonViewType, setComparisonViewType] = useState("flow");

  // Auto-switch to inbound when county is selected
  useEffect(() => {
    if (leftFilters.county && leftFilters.metric === "out") {
      setLeftFilter("metric", "in");
    }
  }, [leftFilters.county, leftFilters.metric, setLeftFilter]);

  useEffect(() => {
    if (rightFilters.county && rightFilters.metric === "out") {
      setRightFilter("metric", "in");
    }
  }, [rightFilters.county, rightFilters.metric, setRightFilter]);

  // Feature rank list for dropdown
  const [featureRank, setFeatureRank] = useState([]);
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

  const leftCounties = leftFilters.state
    ? countiesByState[leftFilters.state] ?? []
    : [];
  const rightCounties = rightFilters.state
    ? countiesByState[rightFilters.state] ?? []
    : [];

  return (
    <div
      style={{ display: "flex", gap: "16px", padding: "16px", height: "100vh" }}
    >
      {/* Left Side */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 10,
            padding: "16px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: "#1f2937" }}>
            📍 Location A
          </h3>

          {/* State and County in same row */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "#4b5563",
                }}
              >
                State
              </label>
              <select
                value={leftFilters.state ?? ""}
                onChange={(e) => setLeftFilter("state", e.target.value || null)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 6,
                  border: "1px solid #cbd2d9",
                  fontSize: 13,
                }}
              >
                <option value="">All States</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.label}
                  </option>
                ))}
              </select>
            </div>

            {/* County Selector */}
            {leftFilters.state && (
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "#4b5563",
                  }}
                >
                  County
                </label>
                <select
                  value={leftFilters.county ?? ""}
                  onChange={(e) =>
                    setLeftFilter("county", e.target.value || null)
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 6,
                    border: "1px solid #cbd2d9",
                    fontSize: 13,
                  }}
                >
                  <option value="">All Counties</option>
                  {leftCounties.map((county) => (
                    <option key={county.id} value={county.id}>
                      {county.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Value Type Toggle - for choropleth mode */}
          {comparisonViewType === "choropleth" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[
                { id: "observed", label: "Observed" },
                { id: "predicted", label: "Predicted" },
              ].map((valueType) => (
                <button
                  key={valueType.id}
                  onClick={() => setLeftFilter("valueType", valueType.id)}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor:
                      (leftFilters.valueType ?? "observed") === valueType.id
                        ? "#1d4ed8"
                        : "#cbd2d9",
                    background:
                      (leftFilters.valueType ?? "observed") === valueType.id
                        ? "#2563eb"
                        : "white",
                    color:
                      (leftFilters.valueType ?? "observed") === valueType.id
                        ? "white"
                        : "#1f2933",
                  }}
                >
                  {valueType.label}
                </button>
              ))}
            </div>
          )}

          {/* Flow controls in compact layout - only in flow mode */}
          {comparisonViewType === "flow" && (
            <div>
              {/* Metric Toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[
                  { id: "in", label: "Inbound" },
                  { id: "out", label: "Outbound" },
                ].map((metric) => {
                  // Outbound only available when state is selected without county
                  const isDisabled = metric.id === "out" && leftFilters.county;
                  return (
                    <button
                      key={metric.id}
                      onClick={() =>
                        !isDisabled && setLeftFilter("metric", metric.id)
                      }
                      disabled={isDisabled}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        border: "1px solid",
                        borderColor:
                          leftFilters.metric === metric.id
                            ? "#1d4ed8"
                            : "#cbd2d9",
                        background: isDisabled
                          ? "#f3f4f6"
                          : leftFilters.metric === metric.id
                          ? "#2563eb"
                          : "white",
                        color: isDisabled
                          ? "#9ca3af"
                          : leftFilters.metric === metric.id
                          ? "white"
                          : "#1f2933",
                        opacity: isDisabled ? 0.6 : 1,
                      }}
                    >
                      {metric.label}
                    </button>
                  );
                })}
              </div>

              {/* Top 10 checkbox and Min Flow slider in compact row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontSize: 12,
                  color: "#4b5563",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                  className="font-mono"
                >
                  Flow
                </span>

                <span style={{ color: "#cbd2d9" }}>|</span>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  className="font-mono"
                >
                  <input
                    type="checkbox"
                    checked={leftFilters.enableTopN ?? true}
                    onChange={(e) =>
                      setLeftFilter("enableTopN", e.target.checked)
                    }
                    style={{ marginRight: 6 }}
                  />
                  Top 10
                </label>

                <span style={{ color: "#cbd2d9" }}>|</span>

                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <label
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Min: {leftFilters.minFlow ?? 0}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={20000}
                    step={100}
                    value={leftFilters.minFlow ?? 0}
                    onChange={(e) =>
                      setLeftFilter("minFlow", Number(e.target.value))
                    }
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* Value Type Toggle - independent for Location A */}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {[
                  { id: "observed", label: "Observed" },
                  { id: "predicted", label: "Predicted" },
                ].map((valueType) => (
                  <button
                    key={valueType.id}
                    onClick={() => setLeftFilter("valueType", valueType.id)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor:
                        (leftFilters.valueType ?? "observed") === valueType.id
                          ? "#1d4ed8"
                          : "#cbd2d9",
                      background:
                        (leftFilters.valueType ?? "observed") === valueType.id
                          ? "#2563eb"
                          : "white",
                      color:
                        (leftFilters.valueType ?? "observed") === valueType.id
                          ? "white"
                          : "#1f2933",
                    }}
                  >
                    {valueType.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Left Map */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {comparisonViewType === "flow" ? (
            <MigrationFlowMap side="left" />
          ) : (
            <ChoroplethMap side="left" />
          )}
        </div>

        {/* Left Summary - show below choropleth map */}
        {comparisonViewType === "choropleth" && <SummaryPanel side="left" />}

        {/* Left Top Destinations Panel and SHAP in horizontal layout - only in flow mode when Top 10 is enabled */}
        {comparisonViewType === "flow" && leftFilters.enableTopN && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              height: "400px",
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                height: "100%",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <TopDestinationsPanel side="left" />
            </div>
            <div
              style={{
                flex: 1,
                height: "100%",
                minHeight: 0,
                overflowY: "scroll",
                scrollbarWidth: "thin", // Firefox
                WebkitOverflowScrolling: "touch", // iOS smooth scrolling
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ShapPanel side="left" />
            </div>
          </div>
        )}

        {/* Left Summary - show in flow mode */}
        {comparisonViewType === "flow" && <SummaryPanel side="left" />}

        {/* Left SHAP - show when Top 10 is disabled */}
        {comparisonViewType === "flow" && !leftFilters.enableTopN && (
          <ShapPanel side="left" />
        )}
      </div>

      {/* Shared Controls Column */}
      <div
        style={{
          width: 216,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 10,
            padding: "16px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: 16,
              color: "#1f2937",
              textAlign: "center",
            }}
          >
            View Controls
          </h3>

          {/* Main View Mode Selector - to exit comparison view */}
          <div
            style={{
              marginBottom: "16px",
              paddingBottom: "16px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
                color: "#4b5563",
              }}
            >
              Main View
            </label>
            {/* First line: Choropleth and Flow */}
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {[
                { id: "choropleth", label: "Choropleth" },
                { id: "flow", label: "Flow" },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setFilter("viewMode", mode.id)}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: "#cbd2d9",
                    background: "white",
                    color: "#1f2933",
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {/* Second line: Comparison */}
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setFilter("viewMode", "comparison")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: "#1d4ed8",
                  background: "#2563eb",
                  color: "white",
                }}
              >
                Comparison
              </button>
            </div>
          </div>

          {/* View Type Toggle - for comparison sub-view type */}
          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
                color: "#4b5563",
              }}
            >
              Comparison Type
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "flow", label: "Flow" },
                { id: "choropleth", label: "Choropleth" },
              ].map((viewType) => (
                <button
                  key={viewType.id}
                  onClick={() => setComparisonViewType(viewType.id)}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor:
                      comparisonViewType === viewType.id
                        ? "#1d4ed8"
                        : "#cbd2d9",
                    background:
                      comparisonViewType === viewType.id ? "#2563eb" : "white",
                    color:
                      comparisonViewType === viewType.id ? "white" : "#1f2933",
                  }}
                >
                  {viewType.label}
                </button>
              ))}
            </div>
          </div>

          {/* Min Flow - only show in flow mode */}
          {comparisonViewType === "flow" && (
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  padding: "12px",
                  background: "#fef3c7",
                  borderRadius: 6,
                  marginBottom: 12,
                  fontSize: 12,
                  color: "#92400e",
                }}
              >
                💡 Tip: Use separate Min Flow sliders below for each location to
                handle different migration scales
              </div>
            </div>
          )}

          {/* Feature Filter (when state selected on either side and in flow mode) */}
          {comparisonViewType === "flow" &&
            (leftFilters.state || rightFilters.state) && (
              <>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 6,
                      color: "#4b5563",
                    }}
                  >
                    Feature Filter
                  </label>
                  <select
                    value={leftFilters.featureId ?? ""}
                    onChange={(e) =>
                      syncSharedFilters({ featureId: e.target.value || null })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: 6,
                      border: "1px solid #cbd2d9",
                      fontSize: 13,
                    }}
                  >
                    <option value="">All features</option>
                    {featureRank.slice(0, 12).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {leftFilters.featureId && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 6,
                        color: "#4b5563",
                      }}
                    >
                      Min Impact (
                      {Math.round(leftFilters.featureFlowQuantile ?? 0)}
                      %)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={leftFilters.featureFlowQuantile ?? 0}
                      onChange={(e) =>
                        syncSharedFilters({
                          featureFlowQuantile: Number(e.target.value),
                        })
                      }
                      style={{ width: "100%" }}
                    />
                    <small
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "#6b7280",
                        marginTop: 4,
                      }}
                    >
                      Shows arcs where this feature's SHAP impact ≥ percentile
                    </small>
                  </div>
                )}
              </>
            )}
        </div>

        <div
          style={{
            background: "#f0f9ff",
            borderRadius: 10,
            padding: "16px",
            border: "1px solid #bae6fd",
            fontSize: 12,
            color: "#0c4a6e",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>💡 Tips</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>
              Toggle between Flow (arcs) and Choropleth (colored counties)
            </li>
            <li style={{ marginBottom: 4 }}>
              Select different states/counties to compare
            </li>
            <li style={{ marginBottom: 4 }}>
              Each location has its own Metric (Inbound/Outbound) toggle
            </li>
            <li style={{ marginBottom: 4 }}>
              Each location has its own Value (Observed/Predicted) toggle
            </li>
            <li style={{ marginBottom: 4 }}>
              Each location has its own Min Flow slider to handle different
              scales
            </li>
            <li style={{ marginBottom: 4 }}>
              Check "Top 10" to show origin/destination bar charts
            </li>
            <li style={{ marginBottom: 4 }}>
              Click arcs to see SHAP features side-by-side
            </li>
            <li>Use feature filter to highlight specific influences</li>
          </ul>
        </div>
      </div>

      {/* Right Side */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 10,
            padding: "16px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: "#1f2937" }}>
            📍 Location B
          </h3>

          {/* State and County in same row */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "#4b5563",
                }}
              >
                State
              </label>
              <select
                value={rightFilters.state ?? ""}
                onChange={(e) =>
                  setRightFilter("state", e.target.value || null)
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 6,
                  border: "1px solid #cbd2d9",
                  fontSize: 13,
                }}
              >
                <option value="">All States</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.label}
                  </option>
                ))}
              </select>
            </div>

            {/* County Selector */}
            {rightFilters.state && (
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "#4b5563",
                  }}
                >
                  County
                </label>
                <select
                  value={rightFilters.county ?? ""}
                  onChange={(e) =>
                    setRightFilter("county", e.target.value || null)
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 6,
                    border: "1px solid #cbd2d9",
                    fontSize: 13,
                  }}
                >
                  <option value="">All Counties</option>
                  {rightCounties.map((county) => (
                    <option key={county.id} value={county.id}>
                      {county.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Value Type Toggle - for choropleth mode */}
          {comparisonViewType === "choropleth" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[
                { id: "observed", label: "Observed" },
                { id: "predicted", label: "Predicted" },
              ].map((valueType) => (
                <button
                  key={valueType.id}
                  onClick={() => setRightFilter("valueType", valueType.id)}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor:
                      (rightFilters.valueType ?? "observed") === valueType.id
                        ? "#1d4ed8"
                        : "#cbd2d9",
                    background:
                      (rightFilters.valueType ?? "observed") === valueType.id
                        ? "#2563eb"
                        : "white",
                    color:
                      (rightFilters.valueType ?? "observed") === valueType.id
                        ? "white"
                        : "#1f2933",
                  }}
                >
                  {valueType.label}
                </button>
              ))}
            </div>
          )}

          {/* Flow controls in compact layout - only in flow mode */}
          {comparisonViewType === "flow" && (
            <div>
              {/* Metric Toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[
                  { id: "in", label: "Inbound" },
                  { id: "out", label: "Outbound" },
                ].map((metric) => {
                  // Outbound only available when state is selected without county
                  const isDisabled = metric.id === "out" && rightFilters.county;
                  return (
                    <button
                      key={metric.id}
                      onClick={() =>
                        !isDisabled && setRightFilter("metric", metric.id)
                      }
                      disabled={isDisabled}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        border: "1px solid",
                        borderColor:
                          rightFilters.metric === metric.id
                            ? "#1d4ed8"
                            : "#cbd2d9",
                        background: isDisabled
                          ? "#f3f4f6"
                          : rightFilters.metric === metric.id
                          ? "#2563eb"
                          : "white",
                        color: isDisabled
                          ? "#9ca3af"
                          : rightFilters.metric === metric.id
                          ? "white"
                          : "#1f2933",
                        opacity: isDisabled ? 0.6 : 1,
                      }}
                    >
                      {metric.label}
                    </button>
                  );
                })}
              </div>

              {/* Top 10 checkbox and Min Flow slider in compact row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontSize: 12,
                  color: "#4b5563",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                  className="font-mono"
                >
                  Flow
                </span>

                <span style={{ color: "#cbd2d9" }}>|</span>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  className="font-mono"
                >
                  <input
                    type="checkbox"
                    checked={rightFilters.enableTopN ?? true}
                    onChange={(e) =>
                      setRightFilter("enableTopN", e.target.checked)
                    }
                    style={{ marginRight: 6 }}
                  />
                  Top 10
                </label>

                <span style={{ color: "#cbd2d9" }}>|</span>

                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <label
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Min: {rightFilters.minFlow ?? 0}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={20000}
                    step={100}
                    value={rightFilters.minFlow ?? 0}
                    onChange={(e) =>
                      setRightFilter("minFlow", Number(e.target.value))
                    }
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* Value Type Toggle - independent for Location B */}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {[
                  { id: "observed", label: "Observed" },
                  { id: "predicted", label: "Predicted" },
                ].map((valueType) => (
                  <button
                    key={valueType.id}
                    onClick={() => setRightFilter("valueType", valueType.id)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor:
                        (rightFilters.valueType ?? "observed") === valueType.id
                          ? "#1d4ed8"
                          : "#cbd2d9",
                      background:
                        (rightFilters.valueType ?? "observed") === valueType.id
                          ? "#2563eb"
                          : "white",
                      color:
                        (rightFilters.valueType ?? "observed") === valueType.id
                          ? "white"
                          : "#1f2933",
                    }}
                  >
                    {valueType.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Map */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {comparisonViewType === "flow" ? (
            <MigrationFlowMap side="right" />
          ) : (
            <ChoroplethMap side="right" />
          )}
        </div>

        {/* Right Summary - show below choropleth map */}
        {comparisonViewType === "choropleth" && <SummaryPanel side="right" />}

        {/* Right Top Destinations Panel and SHAP in horizontal layout - only in flow mode when Top 10 is enabled */}
        {comparisonViewType === "flow" && rightFilters.enableTopN && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              height: "400px",
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                height: "100%",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <TopDestinationsPanel side="right" />
            </div>
            <div
              style={{
                flex: 1,
                height: "100%",
                minHeight: 0,
                overflowY: "scroll",
                scrollbarWidth: "thin", // Firefox
                WebkitOverflowScrolling: "touch", // iOS smooth scrolling
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ShapPanel side="right" />
            </div>
          </div>
        )}

        {/* Right Summary - show in flow mode */}
        {comparisonViewType === "flow" && <SummaryPanel side="right" />}

        {/* Right SHAP - show when Top 10 is disabled */}
        {comparisonViewType === "flow" && !rightFilters.enableTopN && (
          <ShapPanel side="right" />
        )}
      </div>
    </div>
  );
}
