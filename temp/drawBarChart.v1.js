// src/utils/drawBarChart.js
import * as d3 from "d3";

/**
 * Draws a bar chart inside the given SVG element.
 *
 * @param {SVGElement} svgElement - The <svg> DOM node
 * @param {Array<number>} data - Array of numeric values to render
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.marginTop=20]
 * @param {number} [options.marginRight=20]
 * @param {number} [options.marginBottom=30]
 * @param {number} [options.marginLeft=40]
 * @param {string} [options.color="#4a90e2"]
 */


export function drawBarChart(
  svgElement,
  data,
  width,
  height,
  options = {}
) {
  const {
    marginTop = 20,
    marginRight = 20,
    marginBottom = 30,
    marginLeft = 40,
    color = "#4a90e2",
  } = options;

  // Wrap SVG with D3
  const svg = d3.select(svgElement);
  svg.selectAll("*").remove(); // clear previous render

  // Inner chart dimensions
  const innerWidth = width - marginLeft - marginRight;
  const innerHeight = height - marginTop - marginBottom;

  // X scale (band)
  const x = d3.scaleBand()
    .domain(data.map((_, i) => i)) // index-based categories
    .range([0, innerWidth])
    .padding(0.1);

  // Y scale (linear)
  const y = d3.scaleLinear()
    .domain([0, d3.max(data)])
    .nice()
    .range([innerHeight, 0]);

  // Chart group (to account for margins)
  const g = svg
    .append("g")
    .attr("transform", `translate(${marginLeft},${marginTop})`);

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d => d.toString()))
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
    .attr("x", (_, i) => x(i))
    .attr("y", d => y(d))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d))
    .attr("fill", color);
}
