// src/utils/drawHorizontalBarChart.js
import * as d3 from "d3";

/**
 * Draws a horizontal bar chart inside the given SVG element.
 *
 * @param {SVGElement} svgElement - The <svg> DOM node
 * @param {Array<{label: string, value: number}>} data - Array of objects
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 * @param {Object} [options] - Optional configuration
 */
export function drawBarChart(svgElement, data, width, height, options = {}) {
  const {
    marginTop = 10,
    marginRight = 20,
    marginBottom = 20,
    marginLeft = 80,
    color = "#4a90e2",
  } = options;

  const svg = d3.select(svgElement);
  svg.selectAll("*").remove();

  const innerWidth = width - marginLeft - marginRight;
  const innerHeight = height - marginTop - marginBottom;

  // Ensure numeric values (fallback = 0)
  //   const safeData = data.map((d) => ({
  //     label: d.label,
  //     value: Number.isFinite(+d.value) ? +d.value : 0,
  //   }));

  // Sort data before drawing
  const safeData = data
    .map((d, i) =>
      typeof d === "number"
        ? { label: String(i), value: d }
        : { label: d.label, value: +d.value || 0 },
    )
    .sort((a, b) => d3.descending(a.value, b.value));

  const maxValue = d3.max(safeData, (d) => d.value) || 0;

  // Update scales
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(safeData, (d) => d.value) || 0])
    .nice()
    .range([0, innerWidth]);

  const y = d3
    .scaleBand()
    .domain(safeData.map((d) => d.label)) // <- sorted labels
    .range([0, innerHeight])
    .padding(0.1);

  const g = svg
    .append("g")
    .attr("transform", `translate(${marginLeft},${marginTop})`);

  // X axis (bottom)
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(4)
        .tickFormat((d) => d + "%"),
    )
    .selectAll("text")
    .style("font-size", "10px");

  // Y axis
  g.append("g")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("font-size", "10px");

  // Bars
  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("y", (d) => y(d.label))
    .attr("x", (d) => (d.value < 0 ? x(d.value) : x(0)))
    .attr("width", (d) => Math.abs(x(d.value) - x(0)))
    .attr("height", y.bandwidth())
    .attr("fill", (d) => (typeof color === "function" ? color(d) : color));

  // Value labels
  g.selectAll("text.value")
    .data(safeData)
    .join("text")
    .attr("class", "value")
    .attr("x", (d) => x(d.value) + 4)
    .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .style("font-size", "10px")
    .text((d) => `${d.value.toFixed(1)}%`);
}
