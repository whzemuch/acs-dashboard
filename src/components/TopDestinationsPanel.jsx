// src/components/TopDestinationsPanel.jsx
import { useEffect, useState, useRef } from "react";
import { useDashboardStore } from "../store/dashboardStore";
import { getFlows } from "../data/flowServiceShap";
import { getCountyMetadata } from "../data/dataProviderShap";
import * as d3 from "d3";

export default function TopDestinationsPanel({ side = null }) {
  // Support comparison view with left/right filters
  const filters = useDashboardStore((s) =>
    side === "left"
      ? s.leftFilters
      : side === "right"
      ? s.rightFilters
      : s.filters
  );
  const ready = useDashboardStore((s) => s.ready);
  const selectedArc = useDashboardStore((s) =>
    side === "left"
      ? s.leftSelectedArc
      : side === "right"
      ? s.rightSelectedArc
      : s.selectedArc
  );
  const setSelectedArc = useDashboardStore((s) =>
    side === "left"
      ? s.setLeftSelectedArc
      : side === "right"
      ? s.setRightSelectedArc
      : s.setSelectedArc
  );
  const [topFlows, setTopFlows] = useState([]);
  const svgRef = useRef(null);

  console.log(
    `TopDestinationsPanel${side ? ` (${side})` : ""} render - ready:`,
    ready,
    "filters:",
    filters
  );

  useEffect(() => {
    console.log(
      `TopDestinationsPanel${
        side ? ` (${side})` : ""
      } useEffect triggered - ready:`,
      ready
    );
    if (!ready) return;

    (async () => {
      try {
        console.log("Fetching flows with filters:", {
          metric: filters.metric,
          state: filters.state,
          county: filters.county,
          valueType: filters.valueType,
        });

        // Fetch more flows initially to filter out instate
        const fetchCount = 100; // Fetch more for both inbound and outbound to filter
        const flows = await getFlows({
          metric: filters.metric,
          state: filters.state,
          county: filters.county,
          valueType: filters.valueType,
          minFlow: 0,
          topN: fetchCount,
        });

        console.log("Received flows:", flows.length, "flows");
        if (flows.length > 0) {
          console.log("First flow sample:", flows[0]);
          console.log(
            "First flow origin:",
            flows[0].origin,
            "dest:",
            flows[0].dest
          );
        }

        // Process flows
        let resultItems = [];
        const hasState = Boolean(filters.state);
        const isInbound = filters.metric === "in";

        // Helper to compute numeric value per flow respecting valueType
        const getFlowValue = (f) =>
          (filters.valueType === "predicted" ? f.predicted : f.flow) || 0;

        if (hasState) {
          const selectedStateCode = filters.state;

          // Filter out instate flows
          const outstateFlows = flows.filter((f) => {
            if (isInbound) {
              const originCode = String(f.origin);
              const originStateCode = /^\d+$/.test(originCode)
                ? originCode.length === 3
                  ? originCode.substring(1, 3)
                  : originCode.substring(0, 2)
                : null;
              return originStateCode !== selectedStateCode; // keep regions too
            } else {
              const destState = f.dest.substring(0, 2);
              return destState !== selectedStateCode;
            }
          });

          if (isInbound) {
            // Group inbound by origin (state/region) and sum values across destination counties
            const byOrigin = new Map(); // key -> { key, value, sampleFlow }
            for (const f of outstateFlows) {
              const key = String(f.origin);
              const v = getFlowValue(f);
              if (!byOrigin.has(key)) byOrigin.set(key, { key, value: 0, sampleFlow: f });
              const rec = byOrigin.get(key);
              rec.value += v;
              if (getFlowValue(rec.sampleFlow) < v) rec.sampleFlow = f; // keep a representative
            }
            resultItems = [...byOrigin.values()]
              .sort((a, b) => b.value - a.value)
              .slice(0, 10)
              .map((d) => ({ flow: d.sampleFlow, value: d.value }));
          } else {
            // Outbound: keep top destination counties (individual flows)
            resultItems = outstateFlows
              .map((f) => ({ flow: f, value: getFlowValue(f) }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 10);
          }
        } else {
          // No state selected: just show top flows overall in current metric
          resultItems = flows
            .map((f) => ({ flow: f, value: getFlowValue(f) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
        }

        console.log("Setting topFlows state with", resultItems.length, "items");
        setTopFlows(resultItems);
      } catch (error) {
        console.error("Failed to load top flows", error);
        setTopFlows([]);
      }
    })();
  }, [ready, filters.metric, filters.state, filters.county, filters.valueType]);

  // Draw bar chart
  useEffect(() => {
    if (!svgRef.current || topFlows.length === 0) return;

    const countyMetadata = getCountyMetadata();
    const countyMap = new Map(countyMetadata.map((c) => [c.geoid, c]));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const isInbound = filters.metric === "in";
    // Inbound (state names) needs less space, outbound (county names) needs more
    // Reduced by 10% for better layout
    const leftMargin = isInbound ? 120 : 160;
    const margin = { top: 10, right: 80, bottom: 20, left: leftMargin };
    const width = isInbound ? 306 : 360; // Reduced from 340 to 306 (10%) and 400 to 360 (10%)
    const height = Math.max(300, topFlows.length * 30);
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = topFlows.map((item) => {
      const flow = item.flow;
      const flowValue = item.value;

      // For both inbound and outbound: show county name with state
      let label;
      let stateCode;

      if (isInbound) {
        // Inbound: origin is 3-digit code like "012" where last 2 digits are state code
        // OR abbreviated region code like "ASI", "EUR", etc.
        const originCode = String(flow.origin).trim();

        // Map for international regions (matching MigrationFlowMap's REGION_LABELS)
        const REGION_LABELS = {
          ASI: "Asia",
          EUR: "Europe",
          CAM: "Central America",
          AFR: "Africa",
          SAM: "South America",
          NAM: "North America (non‑US)",
          CAR: "Caribbean",
          OCE: "Oceania",
          ISL: "Islands",
        };

        // Check if it's a non-numeric region code (like "ASI", "EUR")
        if (!/^\d+$/.test(originCode)) {
          label = REGION_LABELS[originCode] || originCode;
        } else {
          // US state - extract state code from origin
          stateCode =
            originCode.length === 3
              ? originCode.substring(1, 3) // "012" -> "12"
              : originCode.substring(0, 2); // Fallback for other formats
          // US state - find any county in this state to get the state name
          const anyCountyInState = Array.from(countyMap.values()).find(
            (c) => c.geoid && c.geoid.substring(0, 2) === stateCode
          );

          const stateName =
            anyCountyInState?.stateName || anyCountyInState?.state || stateCode;

          // For inbound, we don't have the specific county, just show state
          label = stateName;
        }
      } else {
        // Outbound: show destination county with state
        const countyCode = flow.dest;
        const county = countyMap.get(countyCode);

        if (county) {
          const countyName = county.name || "Unknown";
          const stateAbbr = county.stateName || county.state || "";
          label = stateAbbr ? `${countyName}, ${stateAbbr}` : countyName;
        } else {
          label = countyCode; // Fallback to code if not found
        }
      }

      // Debug first item
      if (topFlows.indexOf(flow) === 0) {
        console.log(
          `First ${isInbound ? "inbound origin" : "outbound destination"}:`,
          {
            rawCode: isInbound ? flow.origin : flow.dest,
            extractedState: isInbound ? stateCode : "N/A",
            label,
          }
        );
      }

      return {
        flow,
        label: label,
        value: flowValue,
      };
    });

    // Y scale for county names (horizontal bars)
    const y = d3
      .scaleBand()
      .domain(data.map((d, i) => i))
      .range([0, chartHeight])
      .padding(0.2);

    // X scale for flow values
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value)])
      .nice()
      .range([0, chartWidth]);

    // Color ramp: top rank starts with a saturated dark hue and fades toward lighter tones
    const colorDomainMax = Math.max(1, data.length - 1);
    const colorScale = d3
      .scaleLinear()
      .domain([0, colorDomainMax])
      .range(
        isInbound
          ? ["rgb(16, 76, 162)", "rgb(130, 202, 250)"] // Dark blue → light blue
          : ["rgb(180, 80, 0)", "rgb(255, 170, 90)"] // Dark orange → light orange
      );

    // Horizontal bars
    g.selectAll(".bar")
      .data(data)
      .join("rect")
      .attr("class", "bar")
      .attr("x", 0)
      .attr("y", (d, i) => y(i))
      .attr("width", (d) => x(d.value))
      .attr("height", y.bandwidth())
      .attr("fill", (d, i) => {
        // Highlight if this specific arc is selected
        // Use complementary colors: blue for orange bars (outbound), orange for blue bars (inbound)
        return selectedArc && d.flow.id === selectedArc.id
          ? isInbound
            ? "#f97316"
            : "#3b82f6" // Orange for inbound, Blue for outbound
          : colorScale(i); // Gradient for others
      })
      .attr("cursor", "pointer")
      .on("click", function (event, d) {
        // Select individual arc for both inbound and outbound
        setSelectedArc(d.flow);
      })
      .on("mouseover", function (event, d) {
        const isSelected = selectedArc && d.flow.id === selectedArc.id;
        if (!isSelected) {
          // Use complementary colors for hover too
          d3.select(this).attr("fill", isInbound ? "#f97316" : "#3b82f6");
        }
      })
      .on("mouseout", function (event, d) {
        const dataIndex = data.findIndex((item) => item.flow.id === d.flow.id);
        const isSelected = selectedArc && d.flow.id === selectedArc.id;
        if (!isSelected) {
          d3.select(this).attr("fill", colorScale(dataIndex));
        }
      });

    // Value labels to the right of bars
    g.selectAll(".value-label")
      .data(data)
      .join("text")
      .attr("class", "value-label")
      .attr("x", (d) => x(d.value) + 8)
      .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
      .attr("text-anchor", "start")
      .attr("alignment-baseline", "middle")
      .attr("font-size", 12)
      .attr("font-family", "Monaco, monospace")
      .attr("font-weight", 600)
      .attr("fill", "#374151")
      .text((d) => d.value.toLocaleString());

    // Y-axis labels (county names on the left with rank)
    g.selectAll(".y-label")
      .data(data)
      .join("text")
      .attr("class", "y-label")
      .attr("x", -leftMargin)
      .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
      .attr("text-anchor", "start")
      .attr("alignment-baseline", "middle")
      .attr("font-size", 11)
      .attr("font-family", "Monaco, monospace")
      .attr("fill", "#374151")
      .text((d, i) => {
        // Add rank number and truncate long names (county + state)
        const rank = `#${i + 1} `;
        // Adjust max length based on available space
        const maxLen = isInbound ? 18 : 24; // More space for outbound county names
        const truncated =
          d.label.length > maxLen ? d.label.slice(0, maxLen) + "..." : d.label;
        return rank + truncated;
      });

    // X-axis removed since values are displayed on the right of bars
  }, [
    topFlows,
    filters.valueType,
    filters.metric,
    selectedArc,
    setSelectedArc,
  ]);

  if (topFlows.length === 0) {
    return (
      <div
        style={{
          background: "white",
          borderRadius: 8,
          padding: "16px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: 14,
            fontWeight: 600,
            color: "#1f2937",
          }}
          className="font-mono"
        >
          Top 10 {filters.metric === "in" ? "Origins (Inbound)" : "Destinations (Outbound)"}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "#6b7280",
          }}
          className="font-mono"
        >
          Select a state to view top {filters.metric === "in" ? "origins (states/regions)" : "destination counties"}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: 8,
        padding: "16px",
        border: "1px solid #e2e8f0",
      }}
    >
      <h3
        style={{
          margin: "0 0 12px 0",
          fontSize: 14,
          fontWeight: 600,
          color: "#1f2937",
        }}
        className="font-mono"
      >
        Top {topFlows.length} {filters.metric === "in" ? "Origins (Inbound)" : "Destinations (Outbound)"}
      </h3>
      <svg ref={svgRef} style={{ display: "block", margin: "0 auto" }} />
    </div>
  );
}
