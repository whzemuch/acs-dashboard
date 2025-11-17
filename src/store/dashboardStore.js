// src/store/dashboardStore.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
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

export const useDashboardStore = create(
  persist(
    (set, get) => ({
      ready: false,
      filters: {},
      availableYears: [],
      states: [],
      countiesByState: {},
      selectedArc: null,
      selectedOriginState: null, // For highlighting flows from a specific origin state

      // Comparison mode state
      comparisonMode: false,
      leftFilters: {},
      rightFilters: {},
      leftSelectedArc: null,
      rightSelectedArc: null,

      init: async () => {
        if (get().ready) return;

        await initShapProvider();
        const years = []; // SHAP dataset has no years
        const latestYear = null;
        const metadata = getCountyMetadata();

        const defaultFilters = {
          ...getDefaultFilters(latestYear),
          viewMode: "choropleth",
          metric: "in",
          valueType: "observed",
        };

        set({
          ready: true,
          availableYears: years,
          filters: defaultFilters,
          leftFilters: { ...defaultFilters },
          rightFilters: { ...defaultFilters },
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

      setComparisonMode: (enabled) => set({ comparisonMode: enabled }),

      setLeftFilter: (id, value) =>
        set((state) => {
          const updated = { ...state.leftFilters, [id]: value };

          if (id === "state") {
            updated.county = null;
          }

          return { leftFilters: updated };
        }),

      setRightFilter: (id, value) =>
        set((state) => {
          const updated = { ...state.rightFilters, [id]: value };

          if (id === "state") {
            updated.county = null;
          }

          return { rightFilters: updated };
        }),

      // Sync shared filters (metric, valueType, viewMode, minFlow) to both sides
      syncSharedFilters: (updates) => {
        console.log("[dashboardStore] syncSharedFilters called with:", updates);
        set((state) => {
          const newLeft = { ...state.leftFilters, ...updates };
          const newRight = { ...state.rightFilters, ...updates };
          console.log(
            "[dashboardStore] New leftFilters.minFlow:",
            newLeft.minFlow
          );
          console.log(
            "[dashboardStore] New rightFilters.minFlow:",
            newRight.minFlow
          );
          return {
            leftFilters: newLeft,
            rightFilters: newRight,
          };
        });
      },

      setSelectedArc: (arc) => set({ selectedArc: arc }),
      setSelectedOriginState: (stateCode) =>
        set({ selectedOriginState: stateCode }),
      setLeftSelectedArc: (arc) => set({ leftSelectedArc: arc }),
      setRightSelectedArc: (arc) => set({ rightSelectedArc: arc }),

      resetFilters: () =>
        set((state) => {
          const defaultFilters = getDefaultFilters(
            state.availableYears[state.availableYears.length - 1]
          );
          return {
            filters: defaultFilters,
            leftFilters: { ...defaultFilters },
            rightFilters: { ...defaultFilters },
            selectedArc: null,
            leftSelectedArc: null,
            rightSelectedArc: null,
          };
        }),
    }),
    {
      name: "acs-dashboard-prefs",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist only user prefs, not data caches/ready flags
        filters: {
          valueType: state.filters?.valueType,
          showHeatmap: state.filters?.showHeatmap,
          showStateNetOverlay: state.filters?.showStateNetOverlay,
          stateNetOpacity: state.filters?.stateNetOpacity,
        },
      }),
    }
  )
);
