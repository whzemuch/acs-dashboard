// src/data/dataProviderShap.js
// Partition-based data provider for state→county flows with observed/predicted + SHAP

const BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";

const DEFAULT_CONFIG = {
  countyMetaUrl: `${BASE}data/cache/county-metadata.json`,
  summaryUrl: `${BASE}data/cache/summary.json`,
  indexUrl: `${BASE}data/cache/index.json`,
  shapSchemaUrl: `${BASE}data/cache/shap_schema.json`,
  byDestUrl: (code) => `${BASE}data/cache/flows/by_dest/${code}.json`,
  byOriginUrl: (code) => `${BASE}data/cache/flows/by_origin/${code}.json`,
  byDestShapUrl: (code) => `${BASE}data/cache/flows/by_dest_shap/${code}.json`,
  maxArcs: 200,
};

const state = {
  config: { ...DEFAULT_CONFIG },
  initPromise: null,
  countyMetadata: [],
  countyById: new Map(),
  summary: null,
  index: null,
  shapSchema: [],
  byDestCache: new Map(), // code -> payload
  byOriginCache: new Map(), // code -> payload
  byDestShapCache: new Map(), // code -> payload
  memoized: new Map(),
};

export function configure(overrides = {}) {
  state.config = { ...DEFAULT_CONFIG, ...overrides };
  reset();
}

export function reset() {
  state.initPromise = null;
  state.countyMetadata = [];
  state.countyById.clear();
  state.summary = null;
  state.index = null;
  state.shapSchema = [];
  state.byDestCache.clear();
  state.byOriginCache.clear();
  state.byDestShapCache.clear();
  state.memoized.clear();
}

export async function init() {
  if (state.initPromise) return state.initPromise;
  state.initPromise = (async () => {
    const [summary, index, countyMeta, shapSchema] = await Promise.all([
      fetchJSON(state.config.summaryUrl).catch(() => null),
      fetchJSON(state.config.indexUrl).catch(() => null),
      fetchJSON(state.config.countyMetaUrl).catch(() => []),
      fetchJSON(state.config.shapSchemaUrl).catch(() => []),
    ]);

    state.summary = summary;
    state.index = index;
    state.countyMetadata = countyMeta;
    state.shapSchema = Array.isArray(shapSchema) ? shapSchema : [];
    countyMeta.forEach((m) => state.countyById.set(m.geoid, m));
  })();
  return state.initPromise;
}

export function getCountyMetadata() {
  return state.countyMetadata.slice();
}

export function getSummary() {
  return state.summary;
}

export function getShapSchema() {
  return state.shapSchema.slice();
}

/**
 * Filters:
 * - metric: 'in' | 'out' | 'net' (net supported for state scope summaries; arcs return 'in' prioritized)
 * - state: 2-digit FIPS for destination (for 'in') or origin (for 'out')
 * - county: 5-digit GEOID (implies state = county[:2])
 * - valueType: 'observed' | 'predicted'
 * - minFlow: number
 * - topN: number
 */
export async function getFlows(filters = {}) {
  await init();
  const resolved = resolveFilters(filters);
  const cacheKey = JSON.stringify(resolved);
  if (state.memoized.has(cacheKey)) return state.memoized.get(cacheKey);

  const { metric, stateCode, county, valueType, minFlow, topN } = resolved;

  let rows = [];

  if (metric === "in") {
    const destState = stateCode || (county ? county.slice(0, 2) : null);
    if (!destState) {
      state.memoized.set(cacheKey, rows);
      return rows; // require a state or county context
    }
    const payload = await ensureByDest(destState);
    rows = payload?.rows ?? [];
    if (county) rows = rows.filter((r) => r.dest === county);
  } else if (metric === "out") {
    if (!stateCode) {
      state.memoized.set(cacheKey, rows);
      return rows; // outbound requires a state context in this dataset
    }
    // Note: origin partitions keep original code formatting (e.g., '001', '012')
    const originKey = normalizeOriginKey(stateCode);
    const payload = await ensureByOrigin(originKey);
    rows = payload?.rows ?? [];
  } else if (metric === "net") {
    // For arcs, fall back to inbound flows in the selected state (net totals available in summary only)
    const destState = stateCode || (county ? county.slice(0, 2) : null);
    if (destState) {
      const payload = await ensureByDest(destState);
      rows = payload?.rows ?? [];
      if (county) rows = rows.filter((r) => r.dest === county);
    }
  }

  const chosen = rows
    .map((r) => ({
      ...r,
      value: valueType === "predicted" ? r.predicted : r.flow,
    }))
    .filter((r) => r.value >= minFlow)
    .sort((a, b) => b.value - a.value);

  const limited = typeof topN === "number" && topN > 0 ? chosen.slice(0, topN) : chosen;

  // Shape arcs for deck.gl, keep observed/predicted for tooltips
  const arcs = limited.map((r) => ({
    id: r.id,
    origin: r.origin,
    dest: r.dest,
    flow: r.value, // used by width scale
    observed: r.flow,
    predicted: r.predicted,
    originPosition: [r.originLon, r.originLat],
    destPosition: [r.destLon, r.destLat],
  }));

  state.memoized.set(cacheKey, arcs);
  return arcs;
}

export async function getShapForState(stateCode) {
  await init();
  return ensureByDestShap(stateCode);
}

function resolveFilters(filters) {
  const metric = filters.metric || "in";
  const stateCode = filters.state || null; // 2-digit FIPS
  const county = filters.county || null; // 5-digit GEOID
  const valueType = filters.valueType || "observed";
  const minFlow = Number.isFinite(filters.minFlow) ? filters.minFlow : 0;
  const topN = Number.isFinite(filters.topN) ? filters.topN : state.config.maxArcs;
  return { metric, stateCode, county, valueType, minFlow, topN };
}

async function ensureByDest(code2) {
  if (!code2) return null;
  if (!state.byDestCache.has(code2)) {
    const url = typeof state.config.byDestUrl === "function" ? state.config.byDestUrl(code2) : state.config.byDestUrl;
    const payload = await fetchJSON(url);
    state.byDestCache.set(code2, payload);
  }
  return state.byDestCache.get(code2);
}

async function ensureByOrigin(codeAny) {
  if (!codeAny) return null;
  if (!state.byOriginCache.has(codeAny)) {
    const url = typeof state.config.byOriginUrl === "function" ? state.config.byOriginUrl(codeAny) : state.config.byOriginUrl;
    const payload = await fetchJSON(url);
    state.byOriginCache.set(codeAny, payload);
  }
  return state.byOriginCache.get(codeAny);
}

async function ensureByDestShap(code2) {
  if (!code2) return null;
  if (!state.byDestShapCache.has(code2)) {
    const url = typeof state.config.byDestShapUrl === "function" ? state.config.byDestShapUrl(code2) : state.config.byDestShapUrl;
    const payload = await fetchJSON(url);
    state.byDestShapCache.set(code2, payload);
  }
  return state.byDestShapCache.get(code2);
}

function normalizeOriginKey(stateCode2) {
  // by_origin partitions for US states are named as 3-digit strings in source CSV (e.g., 001, 048)
  // Input here is 2-digit FIPS; replicate 3-digit with leading zero.
  const s = String(stateCode2 ?? "").trim();
  if (!s) return s;
  if (/^\d+$/.test(s)) return s.padStart(3, "0");
  return s; // non‑US region keys pass through
}

async function fetchJSON(url) {
  const isAbsoluteHttp = /^https?:/i.test(url);
  const hasProcessCwd = typeof process !== "undefined" && typeof process.cwd === "function";

  if (typeof window === "undefined" && !isAbsoluteHttp && hasProcessCwd) {
    const { readFile } = await import("node:fs/promises");
    const pathModule = await import("node:path");
    const normalized = url.startsWith("/") ? url.slice(1) : url;
    const filePath = pathModule.join(process.cwd(), "public", normalized);
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  }

  if (typeof fetch === "function") {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      return await res.json();
    } catch (err) {
      if (!isAbsoluteHttp && hasProcessCwd) {
        const { readFile } = await import("node:fs/promises");
        const pathModule = await import("node:path");
        const normalized = url.startsWith("/") ? url.slice(1) : url;
        const filePath = pathModule.join(process.cwd(), "public", normalized);
        const content = await readFile(filePath, "utf8");
        return JSON.parse(content);
      }
      throw err;
    }
  }

  if (hasProcessCwd) {
    const { readFile } = await import("node:fs/promises");
    const pathModule = await import("node:path");
    const normalized = url.startsWith("/") ? url.slice(1) : url;
    const filePath = pathModule.join(process.cwd(), "public", normalized);
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  }

  throw new Error(`No fetch implementation available for ${url}`);
}
