import { getFlows as getFlowsDirect } from "./dataProvider";

let workerInstance = null;
let requestId = 0;
const pending = new Map();

function isWorkerSupported() {
  return typeof window !== "undefined" && typeof Worker !== "undefined";
}

function getWorker() {
  if (!isWorkerSupported()) return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL("../workers/flowWorker.js", import.meta.url),
        { type: "module" },
      );

      workerInstance.onmessage = ({ data }) => {
        const { id, success, result, error } = data || {};
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        if (success) {
          entry.resolve(result);
        } else {
          entry.reject(new Error(error || "Unknown worker error"));
        }
      };

      workerInstance.onerror = (event) => {
        console.error("Flow worker error", event);
        pending.forEach(({ reject }) => {
          reject(new Error("Flow worker crashed"));
        });
        pending.clear();
        workerInstance?.terminate();
        workerInstance = null;
      };
    } catch (error) {
      console.warn("Flow worker initialization failed, falling back", error);
      workerInstance = null;
    }
  }
  return workerInstance;
}

async function callWorker(type, payload) {
  const worker = getWorker();
  if (!worker) {
    return getFlowsDirect(payload);
  }

  const id = ++requestId;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}

export function getFlowsViaWorker(filters) {
  return callWorker("getFlows", filters);
}
