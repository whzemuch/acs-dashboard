// scripts/build-flow-cache-shap.js
// Build partitioned caches for state→county flows with observed/predicted + SHAP
// - Base partitions (no SHAP): by_dest/<SS>.json, by_origin/<ID>.json
// - SHAP partitions (arrays): by_dest_shap/<SS>.json
// - Summary + index: summary.json, index.json
// - Schema: shap_schema.json

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import centroid from "@turf/centroid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const dataDir = path.join(publicDir, "data");

// Inputs
const csvPath = path.join(dataDir, "flow", "migration_flows_with_shap_NATIVE.csv");
const countyGeojsonPath = path.join(dataDir, "geo", "cb_2018_us_county_5m_boundaries.geojson");
const stateGeojsonPath = path.join(dataDir, "geo", "cb_2018_us_state_5m_boundaries.geojson");
const countyMetaPath = path.join(dataDir, "cache", "county-metadata.json");

// Outputs
const outDir = path.join(dataDir, "cache");
const flowsOutDir = path.join(outDir, "flows");
const byDestDir = path.join(flowsOutDir, "by_dest");
const byOriginDir = path.join(flowsOutDir, "by_origin");
const byDestShapDir = path.join(flowsOutDir, "by_dest_shap");

// Synthetic centroids for non‑US origin regions (approximate lon/lat)
// Keys taken from dataset: ASI, EUR, CAM, AFR, SAM, NAM, CAR, OCE, ISL
const REGION_CENTROIDS = {
  ASI: { lon: 90.0, lat: 30.0 }, // Asia
  EUR: { lon: 10.0, lat: 50.0 }, // Europe
  CAM: { lon: -90.0, lat: 15.0 }, // Central America
  AFR: { lon: 20.0, lat: 5.0 }, // Africa
  SAM: { lon: -60.0, lat: -15.0 }, // South America
  NAM: { lon: -100.0, lat: 45.0 }, // North America (non‑US)
  CAR: { lon: -75.0, lat: 20.0 }, // Caribbean
  OCE: { lon: 140.0, lat: -25.0 }, // Oceania
  ISL: { lon: -30.0, lat: 64.0 }, // Iceland as placeholder for island region
};

function fips2(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return s.slice(-2).padStart(2, "0");
  return s; // non‑numeric region codes pass through
}
function pad3(v) {
  return String(v ?? "").trim().padStart(3, "0");
}
function pad5(v) {
  return String(v ?? "").trim().padStart(5, "0");
}
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function readJSON(p) {
  const txt = await fs.readFile(p, "utf8");
  return JSON.parse(txt);
}

async function writeJSON(p, data) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2));
}

function buildStateMetadata(stateGeo) {
  const byFips = new Map();
  (stateGeo.features ?? []).forEach((f) => {
    const p = f.properties ?? {};
    const code = fips2(p.STATEFP ?? p.statefp ?? p.STATE ?? p.state);
    const name = p.NAME ?? p.name ?? code;
    let lon = null;
    let lat = null;
    try {
      const c = centroid(f);
      const coords = c?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) [lon, lat] = coords;
    } catch {}
    byFips.set(code, { code, name, lon, lat });
  });
  return byFips;
}

function buildCountyMetadataFromCache(countyMetaJson) {
  const byGeoid = new Map();
  (countyMetaJson ?? []).forEach((p) => {
    const geoid = pad5(p.geoid);
    const state = fips2(p.state);
    const name = p.name ?? geoid;
    const lon = toNum(p.lon);
    const lat = toNum(p.lat);
    byGeoid.set(geoid, { geoid, state, name, lon, lat });
  });
  return byGeoid;
}

function getOriginPosition(originCode, stateMeta) {
  // Numeric US state
  if (/^\d+$/.test(originCode)) {
    const m = stateMeta.get(fips2(originCode));
    if (m && m.lon != null && m.lat != null) return [m.lon, m.lat];
  }
  // International/region code
  const r = REGION_CENTROIDS[originCode];
  if (r) return [r.lon, r.lat];
  return [0, 0];
}

async function main() {
  console.log("Reading inputs…");
  const [csvBuf, countyGeo, stateGeo, countyMetaJson] = await Promise.all([
    fs.readFile(csvPath),
    readJSON(countyGeojsonPath),
    readJSON(stateGeojsonPath),
    readJSON(countyMetaPath).catch(() => []),
  ]);

  const records = parse(csvBuf, { columns: true, trim: true });
  const countyByGeoid = buildCountyMetadataFromCache(countyMetaJson.length ? countyMetaJson : countyGeo);
  const stateByFips = buildStateMetadata(stateGeo);

  // Determine SHAP feature order
  const headers = Object.keys(records[0] ?? {});
  const shapKeys = headers.filter((h) => h.startsWith("shap_") && h !== "shap_base_value");
  // Global + per-county feature aggregations
  const featureGlobal = shapKeys.map(() => ({ sum: 0, sumAbs: 0, count: 0 }));
  const featureCountySum = shapKeys.map(() => new Map()); // idx -> Map(geoid -> sum)
  const featureCountySumAbs = shapKeys.map(() => new Map()); // idx -> Map(geoid -> sumAbs)
  const featureCountyCount = shapKeys.map(() => new Map()); // idx -> Map(geoid -> count)

  // Partitions
  const partByDest = new Map(); // SS -> rows (base)
  const partByOrigin = new Map(); // ID -> rows (base)
  const shapByDest = new Map(); // SS -> rows (shap arrays)

  // Summaries
  const inboundTotalsByCountyObserved = new Map();
  const inboundTotalsByCountyPredicted = new Map();
  const inboundTotalsByStateObserved = new Map();
  const inboundTotalsByStatePredicted = new Map();
  const outboundTotalsByStateObserved = new Map();
  const outboundTotalsByStatePredicted = new Map();

  // Optional adjacency (top‑K)
  const inAdjacency = new Map(); // county -> rows to that county
  const outAdjacencyState = new Map(); // state -> rows from that state

  let maxObserved = 0;
  let maxPredicted = 0;

  console.log("Parsing rows…");
  for (const r of records) {
    const originStateCode = String(r.origin_state_code ?? "").trim();
    const destGeoid = pad5(r.dest_geoid);
    const destStateCode = fips2(r.dest_state_code);
    const destCountyCode = pad3(r.dest_county_code);
    // guard: ensure dest_geoid’s state matches dest_state_code
    if (destGeoid.slice(0, 2) !== destStateCode || destGeoid.slice(2) !== destCountyCode) {
      // Skip malformed rows to keep cache strict
      continue;
    }

    const flow = Number(r.observed_movers);
    const predicted = Number(r.predicted_movers);
    if (!Number.isFinite(flow) || !Number.isFinite(predicted)) continue;

    const county = countyByGeoid.get(destGeoid);
    if (!county) continue;

    const originPos = getOriginPosition(originStateCode, stateByFips);
    const destPos = [county.lon ?? 0, county.lat ?? 0];

    const id = `${originStateCode}-${destGeoid}`;
    const baseRow = {
      id,
      origin: originStateCode,
      dest: destGeoid,
      flow,
      predicted,
      originLon: originPos[0],
      originLat: originPos[1],
      destLon: destPos[0],
      destLat: destPos[1],
    };

    // Base partitions: by_dest / by_origin
    if (!partByDest.has(destStateCode)) partByDest.set(destStateCode, []);
    partByDest.get(destStateCode).push(baseRow);

    if (!partByOrigin.has(originStateCode)) partByOrigin.set(originStateCode, []);
    partByOrigin.get(originStateCode).push(baseRow);

    // SHAP arrays per destination state
    const shapBase = Number(r.shap_base_value);
    const shapValues = shapKeys.map((k) => Number(r[k]));
    if (!shapByDest.has(destStateCode)) shapByDest.set(destStateCode, []);
    shapByDest.get(destStateCode).push({ id, shapBase, shapValues });

    maxObserved = Math.max(maxObserved, flow);
    maxPredicted = Math.max(maxPredicted, predicted);

    // Totals
    accumulate(inboundTotalsByCountyObserved, destGeoid, flow);
    accumulate(inboundTotalsByCountyPredicted, destGeoid, predicted);
    accumulate(inboundTotalsByStateObserved, destStateCode, flow);
    accumulate(inboundTotalsByStatePredicted, destStateCode, predicted);
    accumulate(outboundTotalsByStateObserved, originStateCode, flow);
    accumulate(outboundTotalsByStatePredicted, originStateCode, predicted);

    // Adjacency (trimmed later)
    pushAdj(inAdjacency, destGeoid, baseRow);
    pushAdj(outAdjacencyState, originStateCode, baseRow);

    // Aggregate SHAP: global and per-destination-county
    for (let i = 0; i < shapValues.length; i++) {
      const v = Number(shapValues[i]) || 0;
      const g = featureGlobal[i];
      g.sum += v;
      g.sumAbs += Math.abs(v);
      g.count += 1;

      const sMap = featureCountySum[i];
      const aMap = featureCountySumAbs[i];
      const cMap = featureCountyCount[i];
      sMap.set(destGeoid, (sMap.get(destGeoid) ?? 0) + v);
      aMap.set(destGeoid, (aMap.get(destGeoid) ?? 0) + Math.abs(v));
      cMap.set(destGeoid, (cMap.get(destGeoid) ?? 0) + 1);
    }
  }

  // Sort & trim adjacency lists
  trimAdjacency(inAdjacency, 100);
  trimAdjacency(outAdjacencyState, 100);

  console.log("Writing partitions…");
  await fs.mkdir(byDestDir, { recursive: true });
  await fs.mkdir(byOriginDir, { recursive: true });
  await fs.mkdir(byDestShapDir, { recursive: true });

  // Sort each partition by value (observed desc)
  for (const [code, list] of partByDest) {
    list.sort((a, b) => b.flow - a.flow);
    await writeJSON(path.join(byDestDir, `${code}.json`), {
      code,
      kind: "by_dest",
      maxObserved,
      maxPredicted,
      rows: list,
    });
  }
  for (const [code, list] of partByOrigin) {
    list.sort((a, b) => b.flow - a.flow);
    await writeJSON(path.join(byOriginDir, `${code}.json`), {
      code,
      kind: "by_origin",
      maxObserved,
      maxPredicted,
      rows: list,
    });
  }
  for (const [code, list] of shapByDest) {
    await writeJSON(path.join(byDestShapDir, `${code}.json`), {
      code,
      kind: "by_dest_shap",
      rows: list,
    });
  }

  console.log("Writing summaries…");
  const summary = {
    totalRows: sumMapSizes(partByDest),
    maxObserved,
    maxPredicted,
    inboundTotalsByCountyObserved: Object.fromEntries(inboundTotalsByCountyObserved),
    inboundTotalsByCountyPredicted: Object.fromEntries(inboundTotalsByCountyPredicted),
    inboundTotalsByStateObserved: Object.fromEntries(inboundTotalsByStateObserved),
    inboundTotalsByStatePredicted: Object.fromEntries(inboundTotalsByStatePredicted),
    outboundTotalsByStateObserved: Object.fromEntries(outboundTotalsByStateObserved),
    outboundTotalsByStatePredicted: Object.fromEntries(outboundTotalsByStatePredicted),
    inAdjacency: mapOfArraysToObject(inAdjacency),
    outAdjacencyState: mapOfArraysToObject(outAdjacencyState),
  };
  await writeJSON(path.join(outDir, "summary.json"), summary);

  const index = {
    by_dest: Object.fromEntries([...partByDest.entries()].map(([k, v]) => [k, v.length])),
    by_origin: Object.fromEntries([...partByOrigin.entries()].map(([k, v]) => [k, v.length])),
    by_dest_shap: Object.fromEntries([...shapByDest.entries()].map(([k, v]) => [k, v.length])),
  };
  await writeJSON(path.join(outDir, "index.json"), index);

  await writeJSON(path.join(outDir, "shap_schema.json"), shapKeys);

  // Feature aggregates: global rank and per-feature per-county means
  console.log("Writing feature aggregates…");
  const featDir = path.join(outDir, "feature");
  const byCountyDir = path.join(featDir, "by_county");
  await fs.mkdir(byCountyDir, { recursive: true });

  const featureRank = shapKeys.map((id, i) => {
    const g = featureGlobal[i];
    const mean = g.count ? g.sum / g.count : 0;
    const meanAbs = g.count ? g.sumAbs / g.count : 0;
    return { id, label: prettifyFeature(id), mean, meanAbs, count: g.count };
  }).sort((a, b) => b.meanAbs - a.meanAbs);
  await writeJSON(path.join(featDir, "global_rank.json"), featureRank);

  for (let i = 0; i < shapKeys.length; i++) {
    const id = shapKeys[i];
    const sMap = featureCountySum[i];
    const aMap = featureCountySumAbs[i];
    const cMap = featureCountyCount[i];
    const mean = {};
    const mean_abs = {};
    for (const [geoid, sum] of sMap.entries()) {
      const c = cMap.get(geoid) || 0;
      mean[geoid] = c ? sum / c : 0;
    }
    for (const [geoid, sAbs] of aMap.entries()) {
      const c = cMap.get(geoid) || 0;
      mean_abs[geoid] = c ? sAbs / c : 0;
    }
    await writeJSON(path.join(byCountyDir, `${id}.json`), {
      id,
      label: prettifyFeature(id),
      mean,
      mean_abs,
    });
  }

  console.log("✓ Cache ready");
}

function accumulate(map, key, amount) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function pushAdj(map, key, row) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(row);
}

function trimAdjacency(map, maxEntries) {
  for (const [key, list] of map) {
    list.sort((a, b) => b.flow - a.flow);
    if (list.length > maxEntries) list.splice(maxEntries);
  }
}

function mapOfArraysToObject(map) {
  const obj = {};
  map.forEach((list, key) => (obj[key] = list));
  return obj;
}

function sumMapSizes(map) {
  let total = 0;
  for (const [, v] of map) total += v.length;
  return total;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

function prettifyFeature(key) {
  const k = String(key).replace(/^shap_/, "");
  return k
    .split("_")
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(" ");
}
