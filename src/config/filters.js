import { getDimensions } from "../data/dataProvider";

const METRICS = [
  { id: "net", label: "Net" },
  { id: "in", label: "Inbound" },
  { id: "out", label: "Outbound" },
];

const DEFAULT_FILTERS = {
  year: null,
  metric: "net",
  state: null,
  county: null,
  minFlow: 0,
  topN: 200,
  age: "all",
  income: "all",
  education: "all",
  viewMode: "choropleth",
};

export async function buildFilterConfig() {
  const dimensions = getDimensions() ?? (await getDimensionsAsync());

  return [
    {
      id: "viewMode",
      type: "toggle",
      label: "Map View",
      options: [
        { id: "flow", label: "Flow" },
        { id: "choropleth", label: "Choropleth" },
      ],
    },
    {
      id: "year",
      type: "year-slider",
      label: "Year",
    },
    {
      id: "metric",
      type: "toggle",
      label: "Metric",
      options: METRICS,
    },
    {
      id: "state",
      type: "select",
      label: "State",
      optionsType: "state",
    },
    {
      id: "county",
      type: "search",
      label: "County",
      optionsType: "county",
      dependsOn: "state",
    },
    {
      id: "minFlow",
      type: "slider",
      label: "Minimum flow",
      min: 0,
      max: 2000,
      step: 50,
    },
    {
      id: "age",
      type: "select",
      label: "Age group",
      options: toOptions(dimensions?.age ?? []),
    },
    {
      id: "income",
      type: "select",
      label: "Income",
      options: toOptions(dimensions?.income ?? []),
    },
    {
      id: "education",
      type: "select",
      label: "Education",
      options: toOptions(dimensions?.education ?? []),
    },
  ];
}

export function getDefaultFilters(latestYear) {
  return {
    ...DEFAULT_FILTERS,
    year: latestYear ?? DEFAULT_FILTERS.year,
  };
}

function toOptions(items) {
  return [{ id: "all", label: "All" }, ...items.map((item) => ({
    id: item.id,
    label: item.label,
  }))];
}

async function getDimensionsAsync() {
  try {
    const dimensions = await getDimensions();
    return dimensions;
  } catch (error) {
    console.warn("Failed to load dimensions", error);
    return null;
  }
}
