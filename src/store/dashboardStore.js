// src/store/dashboardStore.js
import { create } from "zustand";

import {
  init as initShapProvider,
  getCountyMetadata,
} from "../data/dataProviderShap";
import { getDefaultFilters } from "../config/filters";

const buildStateOptions = (metadata) => {
  const map = new Map();
  metadata.forEach((row) => {
    if (!row.state) return;
    if (!map.has(row.state)) {
      map.set(row.state, {
        id: row.state,
        label: row.stateName ?? row.state,
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const buildCountiesByState = (metadata) => {
  const result = {};
  metadata.forEach((row) => {
    if (!row.state) return;
    if (!result[row.state]) result[row.state] = [];
    result[row.state].push({
      id: row.geoid,
      label: `${row.name}, ${row.stateName ?? row.state}`,
    });
  });

  Object.values(result).forEach((list) =>
    list.sort((a, b) => a.label.localeCompare(b.label))
  );

  return result;
};

export const useDashboardStore = create((set, get) => ({
  ready: false,
  filters: {},
  availableYears: [],
  states: [],
  countiesByState: {},
  selectedArc: null,

  init: async () => {
    if (get().ready) return;

    await initShapProvider();
    const years = []; // SHAP dataset has no years
    const latestYear = null;
    const metadata = getCountyMetadata();

    set({
      ready: true,
      availableYears: years,
      filters: { ...getDefaultFilters(latestYear), viewMode: "flow", metric: "in" },
      states: buildStateOptions(metadata),
      countiesByState: buildCountiesByState(metadata),
    });
  },

  setFilter: (id, value) =>
    set((state) => {
      const updated = { ...state.filters, [id]: value };

      if (id === "state") {
        updated.county = null;
      }

      return { filters: updated };
    }),

  setSelectedArc: (arc) => set({ selectedArc: arc }),

  resetFilters: () =>
    set((state) => ({
      filters: getDefaultFilters(state.availableYears[state.availableYears.length - 1]),
    })),
}));
