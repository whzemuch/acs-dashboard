import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getFlows } from "./flowService";
import * as dataProvider from "./dataProvider";

const sampleFilters = { year: 2018, metric: "net" };
const mockResult = [{ origin: "01001", dest: "06037", flow: 123 }];

let originalWindow;
let originalWorker;

describe("flowService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    originalWindow = globalThis.window;
    originalWorker = globalThis.Worker;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = originalWorker;
  });

  it("falls back to direct provider when Worker is unavailable", async () => {
    const getFlowsSpy = vi
      .spyOn(dataProvider, "getFlows")
      .mockResolvedValue(mockResult);

    const value = await getFlows(sampleFilters);

    expect(getFlowsSpy).toHaveBeenCalledOnce();
    expect(getFlowsSpy).toHaveBeenCalledWith(sampleFilters);
    expect(value).toEqual(mockResult);
  });

  it("uses worker when available", async () => {
    globalThis.window = {};
    const postMessageMock = vi.fn();
    let messageHandler;

    class MockWorker {
      constructor(..._args) {
        this.postMessage = postMessageMock;
      }
      set onmessage(handler) {
        messageHandler = handler;
      }
      terminate() {}
    }

    globalThis.Worker = MockWorker;

    const getFlowsSpy = vi
      .spyOn(dataProvider, "getFlows")
      .mockResolvedValue(mockResult);

    const resultPromise = getFlows(sampleFilters);

    await vi.waitFor(() => {
      expect(postMessageMock).toHaveBeenCalledTimes(1);
    });

    const call = postMessageMock.mock.calls[0];
    expect(call).toBeDefined();
    const [{ id }] = call;

    messageHandler({ data: { id, success: true, result: mockResult } });

    const value = await resultPromise;
    expect(value).toEqual(mockResult);
    getFlowsSpy.mockRestore();
  });

  it("falls back to direct provider when worker rejects", async () => {
    globalThis.window = {};
    const postMessageMock = vi.fn();
    let messageHandler;

    class FailingWorker {
      constructor(..._args) {
        this.postMessage = postMessageMock;
      }
      set onmessage(handler) {
        messageHandler = handler;
      }
      terminate() {}
    }

    globalThis.Worker = FailingWorker;

    const getFlowsSpy = vi
      .spyOn(dataProvider, "getFlows")
      .mockResolvedValue(mockResult);

    const resultPromise = getFlows(sampleFilters);

    await vi.waitFor(() => {
      expect(postMessageMock).toHaveBeenCalledTimes(1);
    });
    const call = postMessageMock.mock.calls[0];
    expect(call).toBeDefined();
    const [{ id }] = call;

    messageHandler({ data: { id, success: false, error: "boom" } });

    const value = await resultPromise;
    expect(getFlowsSpy).toHaveBeenCalledTimes(1);
    expect(value).toEqual(mockResult);
    getFlowsSpy.mockRestore();
  });
});
