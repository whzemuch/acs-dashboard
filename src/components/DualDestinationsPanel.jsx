// src/components/DualDestinationsPanel.jsx
import { useEffect, useState, useRef } from "react";
import { useDashboardStore } from "../store/dashboardStore";
import { getFlows } from "../data/flowServiceShap";
import { getCountyMetadata } from "../data/dataProviderShap";
import * as d3 from "d3";

export default function DualDestinationsPanel() {
  const filters = useDashboardStore((s) => s.filters);
  const ready = useDashboardStore((s) => s.ready);
  const selectedArc = useDashboardStore((s) => s.selectedArc);
  const setSelectedArc = useDashboardStore((s) => s.setSelectedArc);
  const [instateFlows, setInstateFlows] = useState([]);
  const [outstateFlows, setOutstateFlows] = useState([]);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!ready || !filters.state) return;

    (async () => {
      try {
        const topN = 10; // Always show top 10 in this panel
        const flows = await getFlows({
          metric: filters.metric,
          state: filters.state,
          county: filters.county,
          valueType: filters.valueType,
          minFlow: 0,
          topN: 200, // Fetch more to ensure we have enough for both categories
        });

        const selectedStateCode = filters.state;

        // Separate instate and outstate flows, then get top N from each
        const instateAll = flows.filter((f) =>
          f.dest.startsWith(selectedStateCode)
        );
        const outstateAll = flows.filter(
          (f) => !f.dest.startsWith(selectedStateCode)
        );

        // Sort each by flow value and take top 10
        const instate = instateAll
          .sort((a, b) => {
            const aVal =
              filters.valueType === "predicted" ? a.predicted : a.flow;
            const bVal =
              filters.valueType === "predicted" ? b.predicted : b.flow;
            return bVal - aVal;
          })
          .slice(0, topN);

        const outstate = outstateAll
          .sort((a, b) => {
            const aVal =
              filters.valueType === "predicted" ? a.predicted : a.flow;
            const bVal =
              filters.valueType === "predicted" ? b.predicted : b.flow;
            return bVal - aVal;
          })
          .slice(0, topN);

        setInstateFlows(instate);
        setOutstateFlows(outstate);
      } catch (error) {
        console.error("Failed to load flows", error);
        setInstateFlows([]);
        setOutstateFlows([]);
      }
    })();
  }, [ready, filters.metric, filters.state, filters.county, filters.valueType]);

  // Draw dual bar chart
  useEffect(() => {
    if (
      !svgRef.current ||
      (instateFlows.length === 0 && outstateFlows.length === 0)
    )
      return;

    const countyMetadata = getCountyMetadata();
    const countyMap = new Map(countyMetadata.map((c) => [c.geoid, c]));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const containerWidth = svgRef.current.parentElement?.clientWidth || 800;
    const margin = { top: 10, right: 10, bottom: 20, left: 10 };
    const width = containerWidth - margin.left - margin.right;
    const rowHeight = 25;
    const maxRows = Math.max(instateFlows.length, outstateFlows.length);
    const height = Math.max(
      300,
      maxRows * rowHeight + margin.top + margin.bottom
    );

    svg.attr("width", containerWidth).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Calculate section widths: 30% text left, 40% bars middle, 30% text right
    const leftTextWidth = width * 0.3;
    const middleBarWidth = width * 0.4;
    const rightTextWidth = width * 0.3;

    const barGap = 2; // Small space between instate and outstate bars
    const leftBarStart = leftTextWidth;
    const rightBarStart = leftTextWidth + middleBarWidth / 2 + barGap;

    // Process data
    const instateData = instateFlows.map((flow, i) => {
      const destCounty = countyMap.get(flow.dest);
      const flowValue =
        filters.valueType === "predicted" ? flow.predicted : flow.flow;
      return {
        flow,
        label: destCounty?.name || flow.dest,
        value: flowValue,
        rank: i + 1,
      };
    });

    const outstateData = outstateFlows.map((flow, i) => {
      const destCounty = countyMap.get(flow.dest);
      const flowValue =
        filters.valueType === "predicted" ? flow.predicted : flow.flow;
      return {
        flow,
        label: destCounty?.name || flow.dest,
        value: flowValue,
        rank: i + 1,
      };
    });

    // Scales
    const maxValue = Math.max(
      d3.max(instateData, (d) => d.value) || 0,
      d3.max(outstateData, (d) => d.value) || 0
    );

    const xScaleLeft = d3
      .scaleLinear()
      .domain([0, maxValue])
      .range([0, middleBarWidth / 2 - barGap / 2]);

    const xScaleRight = d3
      .scaleLinear()
      .domain([0, maxValue])
      .range([0, middleBarWidth / 2 - barGap / 2]);

    // ===== COLOR PAIR OPTIONS - Choose one by uncommenting =====

    // OPTION 1: Blue vs Green (Nature inspired)
    // const colorScaleInstate = d3
    //   .scaleLinear()
    //   .domain([0, 9])
    //   .range(["#93c5fd", "#1e40af"]); // Light blue to dark blue

    // const colorScaleOutstate = d3
    //   .scaleLinear()
    //   .domain([0, 9])
    //   .range(["#86efac", "#15803d"]); // Light green to dark green

    // OPTION 2: Purple vs Orange (Warm/Cool contrast)
    // const colorScaleInstate = d3
    //   .scaleLinear()
    //   .domain([0, 9])
    //   .range(["#c4b5fd", "#6d28d9"]); // Light purple to dark purple
    //
    // const colorScaleOutstate = d3
    //   .scaleLinear()
    //   .domain([0, 9])
    //   .range(["#fdba74", "#c2410c"]); // Light orange to dark orange

    // OPTION 3: Teal vs Pink (Modern, high contrast) - ACTIVE
    const colorScaleInstate = d3
      .scaleLinear()
      .domain([0, 9])
      .range(["#5eead4", "#0f766e"]); // Light teal to dark teal

    const colorScaleOutstate = d3
      .scaleLinear()
      .domain([0, 9])
      .range(["#f9a8d4", "#be185d"]); // Light pink to dark pink

    // Draw INSTATE (left side - bars grow LEFT from center)
    instateData.forEach((d, i) => {
      const yPos = i * rowHeight;
      const barWidth = xScaleLeft(d.value);

      // Bar (grows leftward from center)
      g.append("rect")
        .attr("x", leftBarStart + middleBarWidth / 2 - barWidth)
        .attr("y", yPos)
        .attr("width", barWidth)
        .attr("height", rowHeight - 2)
        .attr(
          "fill",
          selectedArc && d.flow.id === selectedArc.id
            ? "#dc2626"
            : colorScaleInstate(i)
        )
        .attr("cursor", "pointer")
        .on("click", () => setSelectedArc(d.flow))
        .on("mouseover", function () {
          if (!selectedArc || d.flow.id !== selectedArc.id) {
            d3.select(this).attr("fill", "#f59e0b");
          }
        })
        .on("mouseout", function () {
          if (!selectedArc || d.flow.id !== selectedArc.id) {
            d3.select(this).attr("fill", colorScaleInstate(i));
          }
        });

      // Label on left
      g.append("text")
        .attr("x", leftTextWidth - 10)
        .attr("y", yPos + rowHeight / 2)
        .attr("text-anchor", "end")
        .attr("alignment-baseline", "middle")
        .attr("font-size", 11)
        .attr("font-family", "Monaco, monospace")
        .attr("fill", "#374151")
        .text(() => {
          const maxLen = 18;
          const label =
            d.label.length > maxLen
              ? d.label.slice(0, maxLen) + "..."
              : d.label;
          return `#${d.rank} ${label}`;
        });
    });

    // Draw OUTSTATE (right side - bars grow RIGHT from center)
    outstateData.forEach((d, i) => {
      const yPos = i * rowHeight;
      const barWidth = xScaleRight(d.value);

      // Bar (grows rightward from center)
      g.append("rect")
        .attr("x", rightBarStart)
        .attr("y", yPos)
        .attr("width", barWidth)
        .attr("height", rowHeight - 2)
        .attr(
          "fill",
          selectedArc && d.flow.id === selectedArc.id
            ? "#dc2626"
            : colorScaleOutstate(i)
        )
        .attr("cursor", "pointer")
        .on("click", () => setSelectedArc(d.flow))
        .on("mouseover", function () {
          if (!selectedArc || d.flow.id !== selectedArc.id) {
            d3.select(this).attr("fill", "#f59e0b");
          }
        })
        .on("mouseout", function () {
          if (!selectedArc || d.flow.id !== selectedArc.id) {
            d3.select(this).attr("fill", colorScaleOutstate(i));
          }
        });

      // Label on right (reduced spacing from 10 to 5)
      g.append("text")
        .attr("x", leftTextWidth + middleBarWidth + 5)
        .attr("y", yPos + rowHeight / 2)
        .attr("text-anchor", "start")
        .attr("alignment-baseline", "middle")
        .attr("font-size", 11)
        .attr("font-family", "Monaco, monospace")
        .attr("fill", "#374151")
        .text(() => {
          const maxLen = 18;
          const label =
            d.label.length > maxLen
              ? d.label.slice(0, maxLen) + "..."
              : d.label;
          return `#${d.rank} ${label}`;
        });
    });

    // Add headers
    g.append("text")
      .attr("x", leftTextWidth / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-family", "Monaco, monospace")
      .attr("font-weight", 600)
      .attr("fill", "#1f2937")
      .text("INSTATE");

    g.append("text")
      .attr("x", leftTextWidth + middleBarWidth + rightTextWidth / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-family", "Monaco, monospace")
      .attr("font-weight", 600)
      .attr("fill", "#1f2937")
      .text("OUTSTATE");
  }, [
    instateFlows,
    outstateFlows,
    filters.valueType,
    selectedArc,
    setSelectedArc,
  ]);

  if (instateFlows.length === 0 && outstateFlows.length === 0) {
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
          Top Destinations
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "#6b7280",
          }}
          className="font-mono"
        >
          Select a state or county to view destinations
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
        Top 10 Instate vs Outstate Destinations
      </h3>
      <svg ref={svgRef} style={{ display: "block", width: "100%" }} />
    </div>
  );
}
