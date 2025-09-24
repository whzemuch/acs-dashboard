import { init as initDataProvider, getFlows } from "../data/dataProvider";

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initDataProvider();
    initialized = true;
  }
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};

  try {
    await ensureInitialized();

    if (type === "getFlows") {
      const result = await getFlows(payload);
      self.postMessage({ id, success: true, result });
      return;
    }

    throw new Error(`Unknown message type: ${type}`);
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
