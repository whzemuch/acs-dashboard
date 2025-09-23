// src/views/ChoroplethPage.jsx
import ChoroplethMap from "../components/ChoroplethMap";
import YearSelector from "../components/YearSelector";

export default function ChoroplethPage() {
  return (
    <div>
      <YearSelector />
      <ChoroplethMap />
    </div>
  );
}
