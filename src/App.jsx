// import PUMAMap from "./PUMAMap";

// function App() {
//   return (
//     <div style={{ width: "100vw", height: "100vh" }}>
//       <PUMAMap />
//     </div>
//   );
// }

// export default App;

// Second version with manual toggle
// import PUMAMap from "./PUMAMap";
// import TestPage from "./views/TestPage";

// function App() {
//   const showTest = true; // toggle manually

//   return (
//     <div style={{ width: "100vw", height: "100vh" }}>
//       {showTest ? <TestPage /> : <PUMAMap />}
//     </div>
//   );
// }

// export default App;

// src/App.js

import { useEffect } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import PUMAMap from "./components/PUMAMap";
import TestPage from "./views/TestPage";
import TestCoeffPage from "./views/TestCoeffPage";
import TestMap from "./views/TestMap";
import ChoroplethPage from "./views/ChoroplethPage";
import { useDashboardStore } from "./store/dashboardStore";

function App() {
  const initStore = useDashboardStore((s) => s.init);

  useEffect(() => {
    initStore();
  }, [initStore]);

  return (
    <div>
      {/* Navigation Menu */}
      {/* <nav style={{ padding: "10px", background: "#f5f5f5" }}>
        <Link to="/" style={{ marginRight: 12 }}>
          PUMA Map
        </Link>
        <Link to="/test" style={{ marginRight: 12 }}>
          Test Page
        </Link>
        <Link to="/test-coeff" style={{ marginRight: 12 }}>
          Coeff Test
        </Link>
        <Link to="/test-map">Mapbox Test</Link>
        <Link to="/choropleth">Choropleth Map</Link>
      </nav> */}

      {/*  Routes */}
      <Routes>
        <Route path="/" element={<Navigate to="/test-map" replace />} />
        <Route path="/test-map" element={<TestMap />} />
        <Route path="/puma" element={<PUMAMap />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/test-coeff" element={<TestCoeffPage />} />
        <Route path="/choropleth" element={<ChoroplethPage />} />
      </Routes>
    </div>
  );
}

export default App;
