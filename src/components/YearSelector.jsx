// src/components/YearSelector.jsx
import { useEffect } from "react";

import { useDashboardStore } from "../store/dashboardStore";

export default function YearSelector() {
  const init = useDashboardStore((s) => s.init);
  const ready = useDashboardStore((s) => s.ready);
  const years = useDashboardStore((s) => s.availableYears);
  const filters = useDashboardStore((s) => s.filters);
  const setFilter = useDashboardStore((s) => s.setFilter);

  useEffect(() => {
    init();
  }, [init]);

  if (!ready) {
    return <div style={{ padding: "8px" }}>Loading filter data…</div>;
  }

  return (
    <div style={{ padding: "8px", background: "#f5f5f5" }}>
      <label>
        Select Year:{" "}
        <select
          value={filters.year ?? years[years.length - 1]}
          onChange={(e) => setFilter("year", Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
