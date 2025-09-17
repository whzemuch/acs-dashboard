// src/views/TestCoeffPage.jsx

import CoeffChart from "../components/CoeffChart";

export default function TestCoeffPage() {
  // Mock PUMA entry with both distribution + coefficients
  const mockStats = {
    ba_or_higher: 0.275,
    hs_or_higher: 0.865,
    less_than_hs: 0.135,
    coefficients: {
      ba_or_higher: 0.12,
      hs_or_higher: 0.07,
      less_than_hs: -0.15,
    },
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Test CoeffChart</h2>

      <div
        style={{
          display: "flex",
          gap: "30px",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h4>Education Distribution</h4>
          <CoeffChart stats={mockStats} mode="distribution" width={260} height={140} />
        </div>

        <div>
          <h4>Wage Premiums</h4>
          <CoeffChart stats={mockStats.coefficients} mode="coefficients" width={260} height={140} />
        </div>
      </div>
    </div>
  );
}
