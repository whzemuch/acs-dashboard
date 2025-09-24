// src/views/TestPage.jsx

import BarChart from "../components/BarChart";

export default function App() {
  const mockData = [5, 10, 8, 15, 12];
  return (
    <div style={{ padding: "20px" }}>
      <h2>Test BarChart</h2>
      <BarChart data={mockData} width={200} height={100} />
    </div>
  );
}

// import { BarChart } from "../components/BarChart";

// export default function TestPage() {
//   const mockData = [5, 10, 8, 15, 12];
//   return (
//     <div style={{ padding: "20px", textAlign: "left" }}>
//       <h2>BarChart Test</h2>
//       <BarChart data={mockData} width={200} height={100} />
//     </div>
//   );
// }
