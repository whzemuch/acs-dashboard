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
import { Routes, Route } from "react-router-dom";
import PUMAMap from "./components/PUMAMap";
import TestPage from "./views/TestPage";
import TestCoeffPage from "./views/TestCoeffPage"; // 👈 import it

function App() {
  return (
    <Routes>
      <Route path="/" element={<PUMAMap />} />
      <Route path="/test" element={<TestPage />} />
      <Route path="/test-coeff" element={<TestCoeffPage />} /> {/* 👈 new */}
    </Routes>
  );
}

export default App;
