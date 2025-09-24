// scripts/build-flow-cache.js
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import centroid from "@turf/centroid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "public", "data");

const flowDir = path.join(dataDir, "flow");
const extendedFlowFile = path.join(flowDir, "flow_extended.csv");

const countyGeojsonPath = path.join(
  dataDir,
  "geo",
  "cb_2018_us_county_5m_boundaries.geojson"
);
const centroidCsvPath = path.join(dataDir, "geo", "county_centroids.csv");

const outDir = path.join(dataDir, "cache");
const flowsOutDir = path.join(outDir, "flows");

const FIPS_TO_STATE = {
  "01": "Alabama",
  "02": "Alaska",
  "04": "Arizona",
  "05": "Arkansas",
  "06": "California",
  "08": "Colorado",
  "09": "Connecticut",
  10: "Delaware",
  11: "District of Columbia",
  12: "Florida",
  13: "Georgia",
  15: "Hawaii",
  16: "Idaho",
  17: "Illinois",
  18: "Indiana",
  19: "Iowa",
  20: "Kansas",
  21: "Kentucky",
  22: "Louisiana",
  23: "Maine",
  24: "Maryland",
  25: "Massachusetts",
  26: "Michigan",
  27: "Minnesota",
  28: "Mississippi",
  29: "Missouri",
  30: "Montana",
  31: "Nebraska",
  32: "Nevada",
  33: "New Hampshire",
  34: "New Jersey",
  35: "New Mexico",
  36: "New York",
  37: "North Carolina",
  38: "North Dakota",
  39: "Ohio",
  40: "Oklahoma",
  41: "Oregon",
  42: "Pennsylvania",
  44: "Rhode Island",
  45: "South Carolina",
  46: "South Dakota",
  47: "Tennessee",
  48: "Texas",
  49: "Utah",
  50: "Vermont",
  51: "Virginia",
  53: "Washington",
  54: "West Virginia",
  55: "Wisconsin",
  56: "Wyoming",
  60: "American Samoa",
  66: "Guam",
  69: "Northern Mariana Islands",
  72: "Puerto Rico",
  78: "U.S. Virgin Islands",
};

const AGE_BUCKETS = [
  { id: "age_18_24", label: "18–24" },
  { id: "age_25_34", label: "25–34" },
  { id: "age_35_44", label: "35–44" },
  { id: "age_45_54", label: "45–54" },
  { id: "age_55_64", label: "55–64" },
  { id: "age_65_plus", label: "65+" },
];

const INCOME_BUCKETS = [
  { id: "inc_lt_25k", label: "<$25k" },
  { id: "inc_25_50k", label: "$25k–$50k" },
  { id: "inc_50_100k", label: "$50k–$100k" },
  { id: "inc_100_plus", label: "$100k+" },
];

const EDU_BUCKETS = [
  { id: "edu_hs", label: "High school or GED" },
  { id: "edu_some_college", label: "Some college" },
  { id: "edu_ba", label: "Bachelor’s" },
  { id: "edu_grad", label: "Graduate degree" },
];

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(flowsOutDir, { recursive: true });

  await writeJson(path.join(outDir, "dimensions.json"), {
    age: AGE_BUCKETS,
    income: INCOME_BUCKETS,
    education: EDU_BUCKETS,
  });

  const extendedRows = await parseExtendedFlows(extendedFlowFile);
  const years = [...new Set(extendedRows.map((row) => row.year))].sort(
    (a, b) => a - b
  );
  await writeJson(path.join(outDir, "years.json"), years);

  const countyMetadata = await buildCountyMetadata(
    countyGeojsonPath,
    centroidCsvPath
  );
  await writeJson(path.join(outDir, "county-metadata.json"), countyMetadata);

  const centroidLookup = new Map(
    countyMetadata.map((row) => [row.geoid, { lon: row.lon, lat: row.lat }])
  );

  for (const year of years) {
    const rowsForYear = extendedRows.filter((row) => row.year === year);
    const payload = buildYearPayload(rowsForYear, centroidLookup);
    await writeJson(path.join(flowsOutDir, `${year}.json`), payload);
    console.log(`✓ cached ${year} (${payload.rows.length} slices)`);
  }

  console.log("Cache ready:", years.join(", "));
}

async function parseExtendedFlows(filePath) {
  const buffer = await fs.readFile(filePath);
  const records = parse(buffer, { columns: true, trim: true });

  return records
    .map((record) => {
      const year = Number(record.year);
      const origin = normalizeCounty(record.origin_geoid ?? record.origin);
      const dest = normalizeCounty(record.dest_geoid ?? record.dest);
      const flow = Number(record.flow);
      if (!origin || !dest || !Number.isFinite(flow)) return null;

      const originLon = toNumber(record.origin_lon);
      const originLat = toNumber(record.origin_lat);
      const destLon = toNumber(record.dest_lon);
      const destLat = toNumber(record.dest_lat);

      return {
        year,
        origin,
        dest,
        flow,
        originLon,
        originLat,
        destLon,
        destLat,
        age: record.age || null,
        income: record.income || null,
        education: record.education || null,
      };
    })
    .filter(Boolean);
}

function buildYearPayload(rows, centroidLookup) {
  const normalizedRows = rows.map((row) => {
    const originCentroid = centroidLookup.get(row.origin) || {};
    const destCentroid = centroidLookup.get(row.dest) || {};

    return {
      ...row,
      originLon: row.originLon ?? originCentroid.lon ?? null,
      originLat: row.originLat ?? originCentroid.lat ?? null,
      destLon: row.destLon ?? destCentroid.lon ?? null,
      destLat: row.destLat ?? destCentroid.lat ?? null,
    };
  });

  const inboundTotals = new Map();
  const outboundTotals = new Map();

  const inAdj = new Map();
  const outAdj = new Map();

  const inboundByAge = new Map();
  const inboundByIncome = new Map();
  const inboundByEducation = new Map();

  let maxFlow = 0;

  normalizedRows.forEach((row) => {
    maxFlow = Math.max(maxFlow, row.flow);

    accumulate(inboundTotals, row.dest, row.flow);
    accumulate(outboundTotals, row.origin, row.flow);

    pushAdjacency(inAdj, row.dest, row);
    pushAdjacency(outAdj, row.origin, row);

    if (row.age) accumulateNested(inboundByAge, row.dest, row.age, row.flow);
    if (row.income)
      accumulateNested(inboundByIncome, row.dest, row.income, row.flow);
    if (row.education)
      accumulateNested(inboundByEducation, row.dest, row.education, row.flow);
  });

  normalizedRows.sort((a, b) => b.flow - a.flow);
  trimAdjacency(inAdj, 100);
  trimAdjacency(outAdj, 100);

  return {
    year: normalizedRows[0]?.year ?? null,
    maxFlow,
    rows: normalizedRows,
    inboundTotals: Object.fromEntries(inboundTotals),
    outboundTotals: Object.fromEntries(outboundTotals),
    inboundTotalsByAge: mapOfMapsToObject(inboundByAge),
    inboundTotalsByIncome: mapOfMapsToObject(inboundByIncome),
    inboundTotalsByEducation: mapOfMapsToObject(inboundByEducation),
    inAdjacency: mapOfArraysToObject(inAdj),
    outAdjacency: mapOfArraysToObject(outAdj),
  };
}

async function buildCountyMetadata(geoJsonPath, centroidCsvPath) {
  const geojson = JSON.parse(await fs.readFile(geoJsonPath, "utf8"));
  const centroidTable = await maybeLoadCentroids(centroidCsvPath);

  return (geojson.features ?? []).map((feature) => {
    const props = feature.properties ?? {};
    const geoid = normalizeCounty(props.GEOID ?? props.geoid);
    const state = normalizeState(props.STATEFP ?? props.statefp);
    const name = props.NAME ?? props.name ?? geoid;

    const fallbackLon = toNumber(props.INTPTLON ?? props.intptlon);
    const fallbackLat = toNumber(props.INTPTLAT ?? props.intptlat);

    const csvCentroid = centroidTable.get(geoid);
    let lon = csvCentroid?.lon ?? fallbackLon;
    let lat = csvCentroid?.lat ?? fallbackLat;

    if ((lon == null || lat == null) && feature.geometry) {
      try {
        const c = centroid(feature);
        const coords = c?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          [lon, lat] = coords;
        }
      } catch (err) {
        // geometry may be invalid; leave null
      }
    }

    return {
      geoid,
      state,
      stateName: FIPS_TO_STATE[state] ?? state,
      name,
      lon,
      lat,
    };
  });
}

async function maybeLoadCentroids(csvPath) {
  try {
    const buffer = await fs.readFile(csvPath);
    const rows = parse(buffer, { columns: true, trim: true });
    const map = new Map();
    rows.forEach((row) => {
      const geoid = normalizeCounty(row.GEOID ?? row.geoid ?? row.id);
      const lon = toNumber(row.lon ?? row.LON ?? row.longitude ?? row.long);
      const lat = toNumber(row.lat ?? row.LAT ?? row.latitude ?? row.lat);
      if (geoid && lon != null && lat != null) {
        map.set(geoid, { lon, lat });
      }
    });
    return map;
  } catch {
    return new Map();
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

function accumulate(map, key, amount) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function accumulateNested(map, primary, secondary, amount) {
  if (!primary || !secondary) return;
  if (!map.has(primary)) map.set(primary, new Map());
  const inner = map.get(primary);
  inner.set(secondary, (inner.get(secondary) ?? 0) + amount);
}

function pushAdjacency(map, key, entry) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(entry);
}

function trimAdjacency(map, maxEntries) {
  map.forEach((list) => {
    list.sort((a, b) => b.flow - a.flow);
    if (list.length > maxEntries) list.splice(maxEntries);
  });
}

function mapOfArraysToObject(map) {
  const obj = {};
  map.forEach((list, key) => {
    obj[key] = list;
  });
  return obj;
}

function mapOfMapsToObject(map) {
  const obj = {};
  map.forEach((inner, key) => {
    obj[key] = Object.fromEntries(inner);
  });
  return obj;
}

function normalizeCounty(id) {
  if (!id) return null;
  return String(id).trim().padStart(5, "0");
}

function normalizeState(id) {
  if (!id) return null;
  return String(id).trim().padStart(2, "0");
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
