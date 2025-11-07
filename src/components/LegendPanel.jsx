import { useDashboardStore } from "../store/dashboardStore";

const legendCard = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  fontSize: 13,
  minWidth: 200,
};

const row = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const splitContainer = {
  display: "flex",
  flexWrap: "nowrap",
  gap: 12,
  alignItems: "center",
};

export default function LegendPanel({ layout = "split" }) {
  if (layout === "flow") {
    return <FlowLegendCard />;
  }
  if (layout === "choropleth") {
    return <ChoroplethLegendCard />;
  }
  if (layout === "stack") {
    return (
      <div style={legendCard}>
        <strong style={{ fontSize: 14 }}>Legend</strong>
        <FlowLegendContent />
        <ChoroplethLegendContent />
      </div>
    );
  }

  return (
    <div style={splitContainer}>
      <FlowLegendCard />
      <ChoroplethLegendCard />
    </div>
  );
}

export function FlowLegendCard() {
  return (
    <div style={legendCard}>
      <strong style={{ fontSize: 14 }}>Flow View</strong>
      <FlowLegendContent />
    </div>
  );
}

export function ChoroplethLegendCard() {
  return (
    <div style={legendCard}>
      <strong style={{ fontSize: 14 }}>Choropleth View</strong>
      <ChoroplethLegendContent />
    </div>
  );
}

function FlowLegendContent() {
  const metric = useDashboardStore((s) => s.filters.metric ?? "net");
  const valueType = useDashboardStore((s) => s.filters.valueType ?? "observed");
  const showHeatmap = useDashboardStore((s) => Boolean(s.filters.showHeatmap));
  const isNetMode = metric === "net";

  return (
    <>
      {isNetMode ? (
        <>
          <LegendRow color="rgba(115, 96, 210, 1)" label="Net gain" />
          <LegendRow color="rgba(166, 54, 98, 1)" label="Net loss" />
        </>
      ) : (
        <>
          <LegendRow color="rgba(130, 202, 250, 1)" label="Inbound flow" />
          <LegendRow color="rgba(255, 140, 0, 1)" label="Outbound flow" />
        </>
      )}
      <div style={{ fontSize: 12, color: "#4a5568" }}>
        Value: <strong>{valueType === "predicted" ? "Predicted" : "Observed"}</strong>. Arc thickness scales with √(value);
        Min Flow slider hides small values.
      </div>
      {showHeatmap && (
        <div style={{ fontSize: 12, color: "#4a5568" }}>
          Heatmap intensity reflects destination {valueType}.
        </div>
      )}
    </>
  );
}

function ChoroplethLegendContent() {
  return (
    <>
      <LegendRow
        color="linear-gradient(90deg, rgba(255,165,0,0.8), rgba(255,115,0,0.8))"
        label="Higher net in"
      />
      <LegendRow
        color="linear-gradient(90deg, rgba(70,130,180,0.8), rgba(30,90,160,0.8))"
        label="Higher net out"
      />
      <div style={{ fontSize: 12, color: "#4a5568" }}>
        Colors scale relative to the active metric and filters.
      </div>
    </>
  );
}

function LegendRow({ color, label }) {
  const style = {
    ...row,
  };
  return (
    <div style={style}>
      <span
        style={{
          width: 28,
          height: 8,
          borderRadius: 4,
          background: color,
          display: "inline-block",
          backgroundImage: color.startsWith("linear-gradient") ? color : undefined,
          backgroundColor: color.startsWith("linear-gradient") ? undefined : color,
        }}
      />
      <span>{label}</span>
    </div>
  );
}
