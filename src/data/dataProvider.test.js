import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { init, getFlows, getNetSeries, reset, configure } from "./dataProvider";

describe("dataProvider", () => {
  beforeAll(async () => {
    await init();
  });

  afterAll(() => {
    reset();
  });

  it("returns flows for the latest year", async () => {
    const flows = await getFlows({ topN: 10 });
    expect(flows.length).toBeGreaterThan(0);
    expect(flows[0]).toHaveProperty("origin");
    expect(flows[0]).toHaveProperty("originPosition");
  });

  it("returns net series for a county", async () => {
    const series = await getNetSeries("06037"); // Los Angeles
    expect(series.length).toBeGreaterThan(0);
    expect(series[0]).toHaveProperty("year");
    expect(series[0]).toHaveProperty("net");
  });
});
