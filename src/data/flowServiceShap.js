import { getFlows as getFlowsDirect, init as initProvider } from "./dataProviderShap";

export async function getFlows(filters) {
  // No worker yet; provider is light and partitioned
  await initProvider();
  return getFlowsDirect(filters);
}

