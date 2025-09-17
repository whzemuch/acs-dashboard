// src/components/CoeffChart.jsx
import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function CoeffChart({ stats, width = 220, height = 120, mode = "distribution" }) {
  const ref = useRef();

  useEffect(() => {
    if (!stats || !ref.current) return;

    // 1. Convert stats object → array
    // convert stats -> array, skip nested objects
    let data = Object.entries(stats)
        .filter(([key, value]) => key !== "PUMA" && typeof value === "number")
        .map(([key, value]) => ({
            label: formatLabel(key),
            value: mode === "distribution" && value <= 1 ? value * 100 : value
        }));

    // sort descending for distribution, descending by coeff for coefficients
    if (mode === "distribution") {
        data.sort((a, b) => d3.descending(a.value, b.value));
    } else if (mode === "coefficients") {
        data.sort((a, b) => d3.descending(a.value, b.value));
    }


    // 2. Setup SVG
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const margin = { top: 10, right: 20, bottom: 20, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // 3. Scales
    const x = d3
      .scaleLinear()
      .domain([
        mode === "coefficients" ? Math.min(0, d3.min(data, (d) => d.value)) : 0,
        d3.max(data, (d) => d.value)
      ])
      .nice()
      .range([0, innerWidth]);

    const y = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, innerHeight])
      .padding(0.1);

    // 4. Axes
    // X axis (bottom)
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(
            d3.axisBottom(x).ticks(4).tickFormat((d) =>
            mode === "distribution" ? d + "%" : d
            )
        )
        .selectAll("text")
        .style("font-size", "10px");


    g.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("font-size", "10px");

    // 5. Optional zero line (for coefficients)
    if (mode === "coefficients") {
      g.append("line")
        .attr("x1", x(0))
        .attr("x2", x(0))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#000")
        .attr("stroke-width", 1);
    }

    // 6. Bars
    g.selectAll("rect")
      .data(data)
      .join("rect")
      .attr("y", (d) => y(d.label))
      .attr("x", (d) => (d.value < 0 ? x(d.value) : x(0)))
      .attr("width", (d) => Math.abs(x(d.value) - x(0)))
      .attr("height", y.bandwidth())
      .attr("fill", (d) =>
        mode === "coefficients"
          ? d.value > 0
            ? "#2ca02c"
            : d.value < 0
            ? "#d62728"
            : "#999"
          : "#1f77b4"
      );

    // 7. Value labels
    g.selectAll("text.value")
      .data(data)
      .join("text")
      .attr("class", "value")
      .attr("x", (d) =>
        d.value >= 0 ? x(d.value) + 4 : x(d.value) - 4
      )
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => (d.value >= 0 ? "start" : "end"))
      .style("font-size", "10px")
      .text((d) =>
        mode === "distribution"
          ? `${d.value.toFixed(1)}%`
          : d.value.toFixed(2)
      );
  }, [stats, width, height, mode]);

  return <svg ref={ref} width={width} height={height}></svg>;
}

// helper
function formatLabel(key) {
  switch (key) {
    case "ba_or_higher":
      return "BA or higher";
    case "hs_or_higher":
      return "HS or higher";
    case "less_than_hs":
      return "Less than HS";
    default:
      return key;
  }
}
