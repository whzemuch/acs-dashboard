// src/store/dashboardStore.js
import { create } from "zustand";

export const useDashboardStore = create((set, get) => ({
  year: 2018,
  counties: null,
  flowsByYear: {},
  maxFlow: 0, // 👈 global max across all years

  setYear: (year) => set({ year }),
  setCounties: (geo) => set({ counties: geo }),
  setFlowsForYear: (year, flows) => {
    const currentMax = get().maxFlow;
    const yearMax = Math.max(...flows.map((r) => r.flow));
    set({
      flowsByYear: { ...get().flowsByYear, [year]: flows },
      maxFlow: Math.max(currentMax, yearMax), // 👈 update global max
    });
  },
}));
