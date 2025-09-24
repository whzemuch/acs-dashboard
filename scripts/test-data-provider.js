import {
  init,
  getFlows,
  getNetSeries,
  reset,
} from "../src/data/dataProvider.js";

async function run() {
  await init();

  const flows = await getFlows({ year: 2020, metric: "net", topN: 3 });
  console.log("Flows count:", flows.length);
  console.log("First flow:", flows[0]);

  const series = await getNetSeries("36061"); // New York County
  console.log("Series sample:", series.slice(0, 2));
}

run().finally(reset);
