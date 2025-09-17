// src/utils/drawBarChart.test.js
import { describe, it, expect } from "vitest";
import * as d3 from "d3";
import { drawBarChart } from "./drawBarChart";

describe("drawBarChart", () => {
  it("draws correct number of bars", () => {
    // Arrange
    document.body.innerHTML = `<svg></svg>`;
    const svgElement = document.querySelector("svg");

    // Act
    drawBarChart(svgElement, [5, 10, 15], 200, 100);

    // Assert
    const rects = d3.select(svgElement).selectAll("rect").nodes();
    expect(rects.length).toBe(3);
  });
});


