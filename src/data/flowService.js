import { getFlows as getFlowsDirect } from "./dataProvider";
import { getFlowsViaWorker } from "./flowWorkerClient";

export async function getFlows(filters) {
  if (typeof window === "undefined") {
    return getFlowsDirect(filters);
  }

  try {
    return await getFlowsViaWorker(filters);
  } catch (error) {
    console.warn("Flow worker failed, falling back to main thread", error);
    return getFlowsDirect(filters);
  }
}
