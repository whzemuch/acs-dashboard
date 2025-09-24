import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDashboardStore } from "./dashboardStore";

describe("dashboardStore", () => {
  const store = useDashboardStore;

  beforeAll(async () => {
    await store.getState().init();
  });

  afterEach(() => {
    store.getState().resetFilters();
  });

  it("initializes metadata and default filters", () => {
    const state = store.getState();
    expect(state.ready).toBe(true);
    expect(state.availableYears.length).toBeGreaterThan(0);
    expect(state.filters.year).toBe(state.availableYears[state.availableYears.length - 1]);
    expect(state.states.length).toBeGreaterThan(0);
  });

  it("updates filters", () => {
    const { setFilter } = store.getState();
    const initial = store.getState();
    const stateKey = initial.states[0].id;

    setFilter("metric", "out");
    setFilter("state", stateKey);

    const afterState = store.getState();
    const county = afterState.countiesByState[stateKey]?.[0];
    expect(county).toBeDefined();

    setFilter("county", county.id);

    const updated = store.getState();
    expect(updated.filters.metric).toBe("out");
    expect(updated.filters.state).toBe(stateKey);
    expect(updated.filters.county).toBe(county.id);
  });

  it("resets filters", () => {
    const { setFilter, resetFilters } = store.getState();
    setFilter("metric", "in");
    setFilter("age", "age_25_34");

    resetFilters();

    const state = store.getState();
    expect(state.filters.metric).toBe("net");
    expect(state.filters.age).toBe("all");
  });
});
