import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

import { useDashboardStore } from "../store/dashboardStore";
import { getCountyMetadata, getYearSummary } from "../data/dataProvider";

const COLORS = {
  net: "#1e5aa0",
  inbound: "#82cafa",
  outbound: "#ff8c00",
};

export default function TrendPanel() {
  const ready = useDashboardStore((s) => s.ready);
  const filters = useDashboardStore((s) => s.filters);
  const availableYears = useDashboardStore((s) => s.availableYears);
  const states = useDashboardStore((s) => s.states);
  const countiesByState = useDashboardStore((s) => s.countiesByState);

  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showComponents, setShowComponents] = useState(
    filters.metric !== "net",
  );

  const svgRef = useRef(null);

  const countyLookup = useMemo(() => {
    if (!ready) return new Map();
    const map = new Map();
    getCountyMetadata().forEach((item) => map.set(item.geoid, item));
    return map;
  }, [ready]);

  const targetInfo = useMemo(() => {
    const countyId = filters.county;
    if (countyId) {
      const meta = countyLookup.get(countyId);
      return {
        type: "county",
        ids: [normalizeGeoid(countyId)],
        label: meta
          ? `${meta.name}, ${meta.stateName ?? meta.state ?? ""}`
          : countyId,
      };
    }

    const stateId = filters.state;
    if (stateId) {
      const stateEntry = states.find((s) => s.id === stateId);
      const stateCounties = (countiesByState[stateId] ?? []).map((entry) =>
        normalizeGeoid(entry.id),
      );
      return {
        type: "state",
        ids: stateCounties,
        label: stateEntry ? stateEntry.label : stateId,
      };
    }

    return {
      type: "national",
      ids: [],
      label: "United States",
    };
  }, [filters.county, filters.state, countyLookup, states, countiesByState]);

  useEffect(() => {
    if (filters.metric !== "net") {
      setShowComponents(true);
    }
  }, [filters.metric]);

  useEffect(() => {
    if (!ready || !availableYears.length) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const sortedYears = [...new Set(availableYears)].sort((a, b) => a - b);

    (async () => {
      try {
        const summaries = await Promise.all(
          sortedYears.map((year) => getYearSummary(year)),
        );

        const nextSeries = summaries.map((summary) =>
          buildYearPoint(summary, targetInfo, filters),
        );

        if (!cancelled) {
          setSeries(nextSeries.filter(Boolean));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to build trend series", err);
          setError(err instanceof Error ? err.message : String(err));
          setSeries([]);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    availableYears,
    filters.county,
    filters.state,
    filters.age,
    filters.income,
    filters.education,
    targetInfo,
  ]);

  useEffect(() => {
    if (!series.length || !svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 680;
    const height = svgRef.current.clientHeight || 260;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const margin = { top: 18, right: 28, bottom: 32, left: 56 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const yearDomain = Array.from(new Set(series.map((point) => point.year))).sort(
      (a, b) => a - b,
    );

    const x = d3.scalePoint().domain(yearDomain).range([0, innerWidth]).padding(0.25);

    const activeKeys = new Set(["net"]);
    if (showComponents || filters.metric !== "net") {
      activeKeys.add("inbound");
      activeKeys.add("outbound");
    }

    const highlightKey =
      filters.metric === "in"
        ? "inbound"
        : filters.metric === "out"
        ? "outbound"
        : "net";
    activeKeys.add(highlightKey);

    const domainValues = [];
    activeKeys.forEach((key) => {
      series.forEach((point) => {
        const value =
          key === "net"
            ? point.net
            : key === "inbound"
            ? point.inbound
            : point.outbound;
        domainValues.push(value);
      });
    });

    const [rawMin, rawMax] = d3.extent(
      domainValues.length ? domainValues : [0],
      (d) => d,
    );
    let min = Number.isFinite(rawMin) ? rawMin : 0;
    let max = Number.isFinite(rawMax) ? rawMax : 0;
    if (min === max) {
      const padding = Math.max(1, Math.abs(min) * 0.1 || 1);
      min -= padding;
      max += padding;
    } else {
      min -= Math.abs(min) * 0.05;
      max += Math.abs(max) * 0.05;
    }

    const y = d3.scaleLinear().domain([min, max]).nice().range([innerHeight, 0]);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xAxis = d3.axisBottom(x).tickValues(yearDomain).tickFormat(d3.format("d"));
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "11px");

    const yAxis = d3
      .axisLeft(y)
      .ticks(6)
      .tickFormat((d) => d3.format(",.0f")(d));
    g.append("g")
      .call(yAxis)
      .selectAll("text")
      .style("font-size", "11px");

    const lineGenerator = d3
      .line()
      .x((d) => x(d.year))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    const metricSeries = [
      { key: "net", label: "Net", color: COLORS.net, enabled: true },
      {
        key: "inbound",
        label: "Inbound",
        color: COLORS.inbound,
        enabled: showComponents || filters.metric !== "net",
      },
      {
        key: "outbound",
        label: "Outbound",
        color: COLORS.outbound,
        enabled: showComponents || filters.metric !== "net",
      },
    ];

    metricSeries
      .filter((line) => line.enabled)
      .forEach((line) => {
        const data = series.map((point) => ({ year: point.year, value: point[line.key] }));

        const isHighlight = line.key === highlightKey;

        g.append("path")
          .datum(data)
          .attr("fill", "none")
          .attr("stroke", line.color)
          .attr("stroke-width", isHighlight ? 3 : 1.75)
          .attr("stroke-linejoin", "round")
          .attr("stroke-linecap", "round")
          .attr("opacity", isHighlight ? 0.95 : 0.75)
          .attr("d", lineGenerator);

        g.selectAll(`circle.point-${line.key}`)
          .data(data)
          .enter()
          .append("circle")
          .attr("class", `point-${line.key}`)
          .attr("cx", (d) => x(d.year))
          .attr("cy", (d) => y(d.value))
          .attr("r", isHighlight ? 3.6 : 2.5)
          .attr("fill", line.color)
          .attr("opacity", isHighlight ? 0.95 : 0.7);
      });

    const pivot = series.find((point) => point.year === filters.year);
    if (pivot) {
      const xPos = x(pivot.year);
      g.append("line")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#9ca3af")
        .attr("stroke-dasharray", "4 4");
    }
  }, [series, filters.year, filters.metric, showComponents]);

  const latestPoint = series.find((point) => point.year === filters.year);
  const highlightKey =
    filters.metric === "in"
      ? "inbound"
      : filters.metric === "out"
      ? "outbound"
      : "net";

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Trends</h3>
          <div style={{ fontSize: 13, color: "#4b5563" }}>{targetInfo.label}</div>
        </div>
        <label style={{ fontSize: 12, color: "#4b5563" }}>
          <input
            type="checkbox"
            checked={showComponents || filters.metric !== "net"}
            disabled={filters.metric !== "net"}
            onChange={(event) => setShowComponents(event.target.checked)}
            style={{ marginRight: 6 }}
          />
          Show inbound/outbound
        </label>
      </div>

      <div style={{ width: "100%", height: 260 }}>
        {loading ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>Loading trend…</div>
        ) : error ? (
          <div style={{ color: "#b91c1c", fontSize: 13 }}>
            Failed to load trend data. {error}
          </div>
        ) : series.length ? (
          <svg ref={svgRef} width="100%" height="100%" role="img" aria-label="Trend chart" />
        ) : (
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            No trend data available for the current selection.
          </div>
        )}
      </div>

      {latestPoint && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            fontSize: 13,
            borderTop: "1px solid #e5e7eb",
            paddingTop: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12, color: "#4b5563", fontWeight: 600 }}>
            Year {latestPoint.year}
          </div>
          <TrendSummaryItem
            label="Net"
            value={latestPoint.net}
            color={COLORS.net}
            bold={highlightKey === "net"}
          />
          <TrendSummaryItem
            label="Inbound"
            value={latestPoint.inbound}
            color={COLORS.inbound}
            muted={!showComponents && filters.metric === "net"}
            bold={highlightKey === "inbound"}
          />
          <TrendSummaryItem
            label="Outbound"
            value={latestPoint.outbound}
            color={COLORS.outbound}
            muted={!showComponents && filters.metric === "net"}
            bold={highlightKey === "outbound"}
          />
        </div>
      )}
    </div>
  );
}

function TrendSummaryItem({ label, value, color, muted, bold }) {
  const display = Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "–";
  const valueColor = muted ? "#9ca3af" : color;
  return (
    <div style={{ color: muted ? "#9ca3af" : "#111827" }}>
      <div style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: bold ? 600 : 500, color: valueColor }}>{display}</div>
    </div>
  );
}

function buildYearPoint(summary, targetInfo, filters) {
  if (!summary) return null;

  const ageFilter = filters.age && filters.age !== "all" ? filters.age : null;
  const incomeFilter = filters.income && filters.income !== "all" ? filters.income : null;
  const educationFilter =
    filters.education && filters.education !== "all" ? filters.education : null;

  const requiresSliceFiltering = Boolean(ageFilter || incomeFilter || educationFilter);

  if (!requiresSliceFiltering) {
    if (!summary.inboundTotals || !summary.outboundTotals) {
      return buildFromRows(summary, targetInfo, {
        ageFilter: null,
        incomeFilter: null,
        educationFilter: null,
      });
    }
    const inbound = sumTotals(summary.inboundTotals, targetInfo);
    const outbound = sumTotals(summary.outboundTotals, targetInfo);

    return {
      year: summary.year,
      inbound,
      outbound,
      net: inbound - outbound,
    };
  }

  return buildFromRows(summary, targetInfo, { ageFilter, incomeFilter, educationFilter });
}

function sumTotals(totalsMap = {}, targetInfo) {
  const entries = Object.entries(totalsMap);
  if (!entries.length) return 0;

  if (targetInfo.type === "national" || !targetInfo.ids?.length) {
    return entries.reduce((sum, [, value]) => sum + value, 0);
  }

  const targetSet = new Set(targetInfo.ids.map(normalizeGeoid));
  let total = 0;
  for (const [geoid, value] of entries) {
    if (targetSet.has(normalizeGeoid(geoid))) total += value;
  }
  return total;
}

function buildFromRows(summary, targetInfo, filters) {
  const rows = summary.rows ?? [];
  const { ageFilter, incomeFilter, educationFilter } = filters;
  const targetSet = new Set(targetInfo.ids.map(normalizeGeoid));

  let inbound = 0;
  let outbound = 0;

  for (const row of rows) {
    if (ageFilter && row.age !== ageFilter) continue;
    if (incomeFilter && row.income !== incomeFilter) continue;
    if (educationFilter && row.education !== educationFilter) continue;

    const originId = normalizeGeoid(row.origin);
    const destId = normalizeGeoid(row.dest);

    if (targetInfo.type === "national") {
      inbound += row.flow;
      outbound += row.flow;
      continue;
    }

    if (targetSet.has(destId)) inbound += row.flow;
    if (targetSet.has(originId)) outbound += row.flow;
  }

  return {
    year: summary.year,
    inbound,
    outbound,
    net: inbound - outbound,
  };
}

function normalizeGeoid(id) {
  if (typeof id === "number") {
    return id.toString().padStart(5, "0");
  }
  if (typeof id === "string") {
    return id.padStart(5, "0");
  }
  return String(id ?? "").padStart(5, "0");
}
