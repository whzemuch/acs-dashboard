// src/views/ComparisonView.jsx
import React, { useEffect, useState } from "react";
import { useDashboardStore } from "../store/dashboardStore";
import MigrationFlowMap from "../components/MigrationFlowMap";
import ChoroplethMap from "../components/ChoroplethMap";
import SummaryPanel from "../components/SummaryPanel";
import ShapPanel from "../components/ShapPanel";

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

          {/* State Selector */}
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

          {/* Min Flow for Location A - only in flow mode */}
          {comparisonViewType === "flow" && (
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
                Min Flow ({leftFilters.minFlow ?? 0})
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
                style={{ width: "100%" }}
              />
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

        {/* Left Summary */}
        <SummaryPanel side="left" />

        {/* Left SHAP */}
        <ShapPanel side="left" />
      </div>

      {/* Shared Controls Column */}
      <div
        style={{
          width: 240,
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
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: "#1f2937" }}>
            ⚙️ Shared Settings
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
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "choropleth", label: "Choropleth" },
                { id: "flow", label: "Flow" },
                { id: "comparison", label: "Comparison" },
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
                    borderColor:
                      mode.id === "comparison" ? "#1d4ed8" : "#cbd2d9",
                    background: mode.id === "comparison" ? "#2563eb" : "white",
                    color: mode.id === "comparison" ? "white" : "#1f2933",
                  }}
                >
                  {mode.label}
                </button>
              ))}
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

          {/* Metric - only show in flow mode */}
          {comparisonViewType === "flow" && (
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
                Metric
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "in", label: "Inbound" },
                  { id: "out", label: "Outbound" },
                ].map((metric) => (
                  <button
                    key={metric.id}
                    onClick={() => syncSharedFilters({ metric: metric.id })}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 6,
                      fontSize: 13,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor:
                        leftFilters.metric === metric.id
                          ? "#1d4ed8"
                          : "#cbd2d9",
                      background:
                        leftFilters.metric === metric.id ? "#2563eb" : "white",
                      color:
                        leftFilters.metric === metric.id ? "white" : "#1f2933",
                    }}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Value Type - only show in flow mode (choropleth always uses observed) */}
          {comparisonViewType === "flow" && (
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
                Value
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "observed", label: "Observed" },
                  { id: "predicted", label: "Predicted" },
                ].map((valueType) => (
                  <button
                    key={valueType.id}
                    onClick={() =>
                      syncSharedFilters({ valueType: valueType.id })
                    }
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 6,
                      fontSize: 13,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor:
                        leftFilters.valueType === valueType.id
                          ? "#1d4ed8"
                          : "#cbd2d9",
                      background:
                        leftFilters.valueType === valueType.id
                          ? "#2563eb"
                          : "white",
                      color:
                        leftFilters.valueType === valueType.id
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
              Each location has its own Min Flow slider to handle different
              scales
            </li>
            <li style={{ marginBottom: 4 }}>
              Click arcs to see SHAP features side-by-side
            </li>
            <li style={{ marginBottom: 4 }}>
              Use feature filter to highlight specific influences
            </li>
            <li>Metric and Value type are shared between locations</li>
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

          {/* State Selector */}
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
              State
            </label>
            <select
              value={rightFilters.state ?? ""}
              onChange={(e) => setRightFilter("state", e.target.value || null)}
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

          {/* Min Flow for Location B - only in flow mode */}
          {comparisonViewType === "flow" && (
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
                Min Flow ({rightFilters.minFlow ?? 0})
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
                style={{ width: "100%" }}
              />
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

        {/* Right Summary */}
        <SummaryPanel side="right" />

        {/* Right SHAP */}
        <ShapPanel side="right" />
      </div>
    </div>
  );
}
