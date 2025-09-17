// src/components/BarChart.jsx
import { useRef, useEffect } from "react";
import { drawBarChart } from "../utils/drawBarChart";

export default function BarChart({ data, width = 300, height = 150 }) {
  const ref = useRef();

  useEffect(() => {
    if (data && ref.current) {
      drawBarChart(ref.current, data, width, height, { color: "#2ca02c" });
    }
  }, [data, width, height]);

  return <svg ref={ref} width={width} height={height}></svg>;
}












// import { useRef, useEffect } from "react";
// import * as d3 from "d3";

// // --- Helper function: draw chart ---
// function drawBarChart(svgElement, data, width, height) {
//   const svg = d3.select(svgElement);
//   svg.selectAll("*").remove(); // clear previous render

//   // X scale (band for categories)
//   const x = d3.scaleBand()
//     .domain(data.map((_, i) => i))
//     .range([0, width])
//     .padding(0.1);

//   // Y scale (linear for values)
//   const y = d3.scaleLinear()
//     .domain([0, d3.max(data)])
//     .nice()
//     .range([height, 0]);

//   // Draw bars
//   svg.append("g")
//     .selectAll("rect")
//     .data(data)
//     .join("rect")
//     .attr("x", (_, i) => x(i))
//     .attr("y", d => y(d))
//     .attr("width", x.bandwidth())
//     .attr("height", d => height - y(d))
//     .attr("fill", "#4a90e2");
// }

// export default function BarChart({ data, width = 200, height = 100 }) {
//   const ref = useRef();

//   useEffect(() => {
//     if (data && ref.current) {
//       drawBarChart(ref.current, data, width, height);
//     }
//   }, [data, width, height]);

//   return <svg ref={ref} width={width} height={height}></svg>;
// }

















// import * as d3 from "d3";
// import { useRef, useEffect } from "react";

// export default function BarChart({ data, width = 180, height = 60 }) {
//   const ref = useRef();

//   useEffect(() => {
//     if (!data) return;

//     const svg = d3.select(ref.current);
//     svg.selectAll("*").remove(); // clear previous render

//     const x = d3.scaleBand()
//       .domain(data.map((d, i) => i))
//       .range([0, width])
//       .padding(0.1);

//     const y = d3.scaleLinear()
//       .domain([0, d3.max(data)])
//       .range([height, 0]);

//     svg.append("g")
//       .selectAll("rect")
//       .data(data)
//       .join("rect")
//       .attr("x", (_, i) => x(i))
//       .attr("y", d => y(d))
//       .attr("width", x.bandwidth())
//       .attr("height", d => height - y(d))
//       .attr("fill", "#4a90e2");

//   }, [data]);

//   return <svg ref={ref} width={width} height={height} />;
// }
