// src/components/YearSelector.jsx
import { useDashboardStore } from "../store/dashboardStore";

export default function YearSelector() {
  const { year, setYear } = useDashboardStore();

  const years = [2018, 2019, 2020];

  return (
    <div style={{ padding: "8px", background: "#f5f5f5" }}>
      <label>
        Select Year:{" "}
        <select value={year} onChange={(e) => setYear(+e.target.value)}>
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
