// src/data/dataProvider.js

const BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.BASE_URL) ||
  "/";

const DEFAULT_CONFIG = {
  countyMetaUrl: `${BASE}data/cache/county-metadata.json`,
  yearsUrl: `${BASE}data/cache/years.json`,
  flowUrl: (year) => `${BASE}data/cache/flows/${year}.json`,
  dimensionsUrl: `${BASE}data/cache/dimensions.json`,
  maxArcs: 200,
};

const state = {
  config: { ...DEFAULT_CONFIG },

  initPromise: null,
  years: [],
  dimensions: null,
  countyMetadata: [],
  countyById: new Map(), // geoid -> metadata
  countiesByState: new Map(), // state FIPS -> array of geoids

  flowsByYear: new Map(), // year -> payload from cache
  memoizedSelectors: new Map(), // stringified filters -> arcs
};

export function configure(overrides = {}) {
  state.config = { ...DEFAULT_CONFIG, ...overrides };
  reset();
}

export function reset() {
  state.initPromise = null;
  state.years = [];
  state.dimensions = null;
  state.countyMetadata = [];
  state.countyById.clear();
  state.countiesByState.clear();
  state.flowsByYear.clear();
  state.memoizedSelectors.clear();
}

export async function init() {
  if (state.initPromise) return state.initPromise;

  state.initPromise = (async () => {
    const [years, countyMeta, dimensions] = await Promise.all([
      fetchJSON(state.config.yearsUrl),
      fetchJSON(state.config.countyMetaUrl),
      fetchJSON(state.config.dimensionsUrl).catch(() => null),
    ]);

    state.years = years;
    state.countyMetadata = countyMeta;
    state.dimensions = dimensions;

    countyMeta.forEach((entry) => {
      state.countyById.set(entry.geoid, entry);

      if (!state.countiesByState.has(entry.state)) {
        state.countiesByState.set(entry.state, []);
      }
      state.countiesByState.get(entry.state).push(entry.geoid);
    });
  })();

  return state.initPromise;
}

export async function ensureYearLoaded(year) {
  await init();
  if (state.flowsByYear.has(year)) return;

  const url =
    typeof state.config.flowUrl === "function"
      ? state.config.flowUrl(year)
      : state.config.flowUrl;

  const payload = await fetchJSON(url);
  state.flowsByYear.set(year, payload);
  // invalidate memoized selectors touching this year
  for (const key of state.memoizedSelectors.keys()) {
    if (key.includes(`"${year}"`)) {
      state.memoizedSelectors.delete(key);
    }
  }
}

export function getAvailableYears() {
  return state.years.slice();
}

export function getDimensions() {
  return state.dimensions;
}

export function getCountyMetadata() {
  return state.countyMetadata.slice();
}

export function getCountyName(geoid) {
  return state.countyById.get(geoid)?.name ?? geoid;
}

export function getCountyStateName(geoid) {
  return state.countyById.get(geoid)?.stateName ?? null;
}

export async function getFlows(filters = {}) {
  const resolved = await resolveFilters(filters);
  const cacheKey = JSON.stringify(resolved);

  if (state.memoizedSelectors.has(cacheKey)) {
    return state.memoizedSelectors.get(cacheKey);
  }

  const { year } = resolved;
  const payload = state.flowsByYear.get(year);
  if (!payload) return [];

  const arcs = selectFlows(payload, resolved);
  state.memoizedSelectors.set(cacheKey, arcs);
  return arcs;
}

export async function getNetSeries(geoid, filters = {}) {
  if (!geoid) return [];

  const resolved = await resolveFilters(filters);
  const years = state.years.length ? state.years : [resolved.year];

  const series = [];
  for (const year of years) {
    await ensureYearLoaded(year);
    const payload = state.flowsByYear.get(year);
    const inbound = payload.inboundTotals?.[geoid] ?? 0;
    const outbound = payload.outboundTotals?.[geoid] ?? 0;

    series.push({
      year,
      in: inbound,
      out: outbound,
      net: inbound - outbound,
    });
  }
  return series;
}

export async function getInOutSeries(geoid, filters = {}) {
  if (!geoid) return [];

  const resolved = await resolveFilters(filters);
  const years = state.years.length ? state.years : [resolved.year];

  const series = [];
  for (const year of years) {
    await ensureYearLoaded(year);
    const payload = state.flowsByYear.get(year);
    const inbound = payload.inboundTotals?.[geoid] ?? 0;
    const outbound = payload.outboundTotals?.[geoid] ?? 0;

    series.push({
      year,
      inbound,
      outbound,
    });
  }
  return series;
}

export async function getYearSummary(year) {
  await init();
  const target = year ?? state.years[state.years.length - 1];
  await ensureYearLoaded(target);
  return state.flowsByYear.get(target);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

async function resolveFilters(filters) {
  await init();
  const {
    year = state.years[state.years.length - 1],
    metric = "net",
    minFlow = 0,
    topN = state.config.maxArcs,
    threshold = null,
    state: stateFilter = null,
    county = null,
    age = null,
    income = null,
    education = null,
  } = filters;

  await ensureYearLoaded(year);

  return {
    year,
    metric,
    minFlow,
    topN,
    threshold,
    state: stateFilter,
    county,
    age,
    income,
    education,
  };
}

function selectFlows(payload, filters) {
  const {
    metric,
    minFlow,
    topN,
    state: stateFilter,
    county,
    age,
    income,
    education,
  } = filters;

  const baseRows = payload.rows ?? [];
  let candidates = baseRows;

  if (age && age !== "all") {
    candidates = candidates.filter((row) => row.age === age);
  }
  if (income && income !== "all") {
    candidates = candidates.filter((row) => row.income === income);
  }
  if (education && education !== "all") {
    candidates = candidates.filter((row) => row.education === education);
  }

  if (stateFilter) {
    const targetCounties = new Set(
      state.countiesByState.get(stateFilter) ?? []
    );
    candidates = candidates.filter(
      (row) => targetCounties.has(row.origin) || targetCounties.has(row.dest)
    );
  }

  if (county) {
    const target = String(county).padStart(5, "0");
    if (metric === "in") {
      candidates = payload.inAdjacency?.[target] ?? [];
    } else if (metric === "out") {
      candidates = payload.outAdjacency?.[target] ?? [];
    } else {
      const inRows = payload.inAdjacency?.[target] ?? [];
      const outRows = payload.outAdjacency?.[target] ?? [];
      candidates = [...inRows, ...outRows];
    }
  }

  let arcs = candidates.filter((row) => row.flow >= minFlow);

  arcs.sort((a, b) => b.flow - a.flow);
  if (typeof topN === "number" && topN > 0) {
    arcs = arcs.slice(0, topN);
  }

  return arcs.map((row) => ({
    id: `${row.year}-${row.origin}-${row.dest}-${row.age ?? "any"}-${
      row.income ?? "any"
    }-${row.education ?? "any"}`,
    year: row.year,
    origin: row.origin,
    dest: row.dest,
    flow: row.flow,
    originPosition: [row.originLon, row.originLat],
    destPosition: [row.destLon, row.destLat],
    age: row.age,
    income: row.income,
    education: row.education,
  }));
}

async function fetchJSON(url) {
  const isAbsoluteHttp = /^https?:/i.test(url);

  if (typeof window === "undefined" && !isAbsoluteHttp) {
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
      if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status}`);
      }
      return await res.json();
    } catch (error) {
      // Node environments may throw ERR_INVALID_URL for relative paths.
      if (!isAbsoluteHttp) {
        const { readFile } = await import("node:fs/promises");
        const pathModule = await import("node:path");
        const normalized = url.startsWith("/") ? url.slice(1) : url;
        const filePath = pathModule.join(process.cwd(), "public", normalized);
        const content = await readFile(filePath, "utf8");
        return JSON.parse(content);
      }
      throw error;
    }
  }

  throw new Error(`No fetch implementation available for ${url}`);
}
