// src/store/dashboardStore.js
import { create } from "zustand";

export const useDashboardStore = create((set, get) => ({
  year: 2018,
  counties: null,
  flowsByYear: {}, // { 2018: [...rows], 2019: [...rows], ... }

  setYear: (year) => set({ year }),
  setCounties: (geo) => set({ counties: geo }),
  setFlowsForYear: (year, flows) =>
    set({ flowsByYear: { ...get().flowsByYear, [year]: flows } }),
}));
