// src/components/ChoroplethMap.jsx
import { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { Map as ReactMap } from "react-map-gl";
import { GeoJsonLayer } from "@deck.gl/layers";
import { scaleQuantile } from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";
import { color as d3color } from "d3-color";
import { FlyToInterpolator, WebMercatorViewport } from "@deck.gl/core";

import { useDashboardStore } from "../store/dashboardStore";
import { getCountyMetadata, getSummary, getFeatureAggNational } from "../data/dataProviderShap";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const COUNTIES_GEOJSON = `${
  import.meta.env.BASE_URL
}data/geo/cb_2018_us_county_5m_boundaries.geojson`;
const STATES_GEOJSON = `${
  import.meta.env.BASE_URL
}data/geo/cb_2018_us_state_5m_boundaries.geojson`;
const INITIAL_VIEW_STATE = { longitude: -98, latitude: 39, zoom: 3.4 };

export default function ChoroplethMap() {
  const initStore = useDashboardStore((s) => s.init);
  const ready = useDashboardStore((s) => s.ready);
  const filters = useDashboardStore((s) => s.filters);

  const [countiesGeo, setCountiesGeo] = useState(null);
  const [statesGeo, setStatesGeo] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [featureAgg, setFeatureAgg] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  useEffect(() => {
    initStore();
  }, [initStore]);

  useEffect(() => {
    fetch(COUNTIES_GEOJSON)
      .then((res) => res.json())
      .then(setCountiesGeo)
      .catch((error) => console.error("Failed to load county geojson", error));
  }, []);

  useEffect(() => {
    fetch(STATES_GEOJSON)
      .then((res) => res.json())
      .then(setStatesGeo)
      .catch((error) => console.error("Failed to load state geojson", error));
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      const summary = getSummary();
      setSummaryData(summary || null);
    } catch (error) {
      console.error("Failed to build choropleth data", error);
      setSummaryData(null);
    }
  }, [ready, filters.viewMode]);

  const colorData = useMemo(() => {
    // Feature Impact mode: color by feature aggregate (national)
    if (filters.viewMode === "feature" && featureAgg && featureAgg.values) {
      const vals = Object.values(featureAgg.values).map((v) => Number(v) || 0);
      const buckets = 7;
      const palette = Array.from({ length: buckets }, (_, i) => d3color(interpolateYlOrRd((i + 1) / buckets)));
      const range = palette.map((c) => [c.r, c.g, c.b, 200]);
      const domain = (filters.featureAgg ?? "mean_abs") === "mean"
        ? vals.map((v) => Math.abs(v)).filter((v) => v > 0)
        : vals.filter((v) => v > 0);
      const q = domain.length ? scaleQuantile().domain(domain).range(range) : null;
      const toColor = (v) => {
        const z = (filters.featureAgg ?? "mean_abs") === "mean" ? Math.abs(v || 0) : (v || 0);
        return q ? q(z) : [240, 240, 240, 120];
      };
      return { map: featureAgg.values, toColor, max: Math.max(...domain, 0) };
    }
    // Default: inbound choropleth from summary
    const metric = filters.metric ?? "in";
    const stateFilter = filters.state ?? null;
    const valueType = filters.valueType ?? "observed";
    const base = buildChoropleth(summaryData, metric, stateFilter, valueType);
    const values = Object.values(base.map).filter((v) => Number.isFinite(v) && v > 0);
    let toColor = () => [240, 240, 240, 120];
    if (values.length) {
      const buckets = 7;
      const palette = Array.from({ length: buckets }, (_, i) => d3color(interpolateYlOrRd((i + 1) / buckets)));
      const range = palette.map((c) => [c.r, c.g, c.b, 200]);
      const q = scaleQuantile().domain(values).range(range);
      toColor = (v) => q(v ?? 0);
    }
    return { ...base, toColor };
  }, [summaryData, filters.metric, filters.state, filters.valueType, filters.viewMode, featureAgg, filters.featureAgg]);

  // Feature aggregates loader
  useEffect(() => {
    if (!ready) return;
    if (filters.viewMode !== "feature" || !filters.featureId) {
      setFeatureAgg(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getFeatureAggNational(filters.featureId, filters.featureAgg ?? "mean_abs");
        if (!cancelled) setFeatureAgg(data);
      } catch (e) {
        if (!cancelled) setFeatureAgg(null);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, filters.viewMode, filters.featureId, filters.featureAgg]);

  const countyLookup = useMemo(() => {
    const map = new Map();
    if (!ready) return map;
    getCountyMetadata().forEach((entry) => map.set(entry.geoid, entry));
    return map;
  }, [ready]);

  const countyFeatureMap = useMemo(() => {
    if (!countiesGeo?.features) return new Map();
    const map = new Map();
    countiesGeo.features.forEach((feature) => {
      const geoid = feature.properties?.GEOID;
      if (geoid) map.set(geoid, feature);
    });
    return map;
  }, [countiesGeo]);

  const stateFeatureMap = useMemo(() => {
    if (!statesGeo?.features) return new Map();
    const map = new Map();
    statesGeo.features.forEach((feature) => {
      const id = feature.properties?.STATEFP;
      if (id) map.set(id, feature);
    });
    return map;
  }, [statesGeo]);

  const countyLayer = useMemo(() => {
    if (!countiesGeo) return null;
    const selectedCounty = filters.county ?? null;
    return new GeoJsonLayer({
      id: `counties-${filters.year}-${filters.state ?? "all"}`,
      data: countiesGeo,
      filled: true,
      stroked: true,
      getFillColor: (feature) => {
        const geoid = feature.properties.GEOID;
        const value = colorData.map[geoid] ?? 0;
        const fill = colorData.toColor(value);
        if (filters.state && feature.properties.STATEFP !== filters.state) {
          return [230, 230, 230, 40];
        }
        return fill;
      },
      getLineColor: (feature) => {
        const geoid = feature.properties.GEOID;
        if (selectedCounty && geoid === selectedCounty) return [0, 0, 0, 230];
        return [100, 100, 100, 150];
      },
      lineWidthUnits: "pixels",
      getLineWidth: (feature) => {
        const geoid = feature.properties.GEOID;
        if (selectedCounty && geoid === selectedCounty) return 3.0;
        return 1.0;
      },
      pickable: true,
      autoHighlight: true,
      onHover: (info) => {
        if (!info.object) {
          setHoverInfo(null);
          return;
        }
        const { GEOID, NAME, STATEFP } = info.object.properties;
        const stateMeta = countyLookup.get(GEOID);
        const stateName = stateMeta?.stateName ?? STATEFP;

        // Get both observed and predicted values for county
        const inboundObs =
          summaryData?.inboundTotalsByCountyObserved?.[GEOID] ?? 0;
        const inboundPred =
          summaryData?.inboundTotalsByCountyPredicted?.[GEOID] ?? 0;

        const lines = [`${NAME}, ${stateName} (GEOID: ${GEOID})`];

        // Show both Observed and Predicted inbound values
        lines.push(
          `Inbound (Obs): ${inboundObs.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`
        );

        lines.push(
          `Inbound (Pred): ${inboundPred.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`
        );
        if (filters.age && filters.age !== "all")
          lines.push(`Age: ${filters.age}`);
        if (filters.income && filters.income !== "all")
          lines.push(`Income: ${filters.income}`);
        if (filters.education && filters.education !== "all")
          lines.push(`Education: ${filters.education}`);
        setHoverInfo({ x: info.x, y: info.y, text: lines.join("\n") });
      },
      updateTriggers: {
        getLineColor: [filters.county, filters.state],
        getLineWidth: [filters.county, filters.state],
      },
    });
  }, [countiesGeo, colorData, filters, countyLookup, summaryData]);

  const stateNetLayer = useMemo(() => {
    if (!statesGeo || !summaryData || !filters.showStateNetOverlay) return null;
    const valueType =
      filters.valueType === "predicted" ? "predicted" : "observed";
    const inbound =
      valueType === "predicted"
        ? summaryData.inboundTotalsByStatePredicted
        : summaryData.inboundTotalsByStateObserved;
    const outbound =
      valueType === "predicted"
        ? summaryData.outboundTotalsByStatePredicted
        : summaryData.outboundTotalsByStateObserved;
    const maxAbs =
      Object.keys(inbound || {}).reduce((m, k) => {
        const v = (inbound?.[k] || 0) - (outbound?.[k] || 0);
        return Math.max(m, Math.abs(v));
      }, 0) || 1;
    const opacityFactor = Math.max(
      0.1,
      Math.min(1, filters.stateNetOpacity ?? 0.6)
    );

    return new GeoJsonLayer({
      id: "state-net-fill",
      data: statesGeo,
      filled: true,
      stroked: false,
      getFillColor: (feature) => {
        const id = feature.properties?.STATEFP;
        const net = (inbound?.[id] || 0) - (outbound?.[id] || 0);
        if (!net) return [0, 0, 0, 0];
        const a = Math.min(
          200,
          Math.floor((Math.abs(net) / maxAbs) * 200 * opacityFactor)
        );
        // net>0 (in>out): orange, net<0: blue
        return net > 0 ? [255, 165, 0, a] : [30, 90, 160, a];
      },
      pickable: false,
    });
  }, [
    statesGeo,
    summaryData,
    filters.showStateNetOverlay,
    filters.valueType,
    filters.stateNetOpacity,
  ]);

  const stateLayer = useMemo(() => {
    if (!statesGeo) return null;
    return new GeoJsonLayer({
      id: "state-outline",
      data: statesGeo,
      filled: false,
      stroked: true,
      getLineColor: [60, 60, 60, 220],
      lineWidthMinPixels: 1,
    });
  }, [statesGeo]);

  const layers = useMemo(
    () => [stateNetLayer, stateLayer, countyLayer].filter(Boolean),
    [stateNetLayer, stateLayer, countyLayer]
  );

  useEffect(() => {
    if (!ready) return;

    let targetFeature = null;
    if (filters.county && countyFeatureMap.has(filters.county)) {
      targetFeature = countyFeatureMap.get(filters.county);
    } else if (filters.state && stateFeatureMap.has(filters.state)) {
      targetFeature = stateFeatureMap.get(filters.state);
    }

    if (!targetFeature) {
      setViewState((prev) => applyViewTransition(prev, INITIAL_VIEW_STATE));
      return;
    }

    const bounds = extractBounds(targetFeature);
    if (!bounds) return;

    setViewState((prev) => {
      const viewport = new WebMercatorViewport({
        width: 1200,
        height: 800,
        longitude: prev.longitude,
        latitude: prev.latitude,
        zoom: prev.zoom,
      });

      const padding = filters.county ? 60 : 140;
      let { longitude, latitude, zoom } = viewport.fitBounds(bounds, {
        padding,
      });
      zoom = Math.min(zoom, filters.county ? 8 : 6);

      return applyViewTransition(prev, { longitude, latitude, zoom });
    });
  }, [ready, filters.county, filters.state, countyFeatureMap, stateFeatureMap]);

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        minWidth: 0,
      }}
    >
      <DeckGL
        viewState={viewState}
        controller
        onViewStateChange={({ viewState: next }) => setViewState(next)}
        layers={layers}
      >
        <ReactMap
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v11"
        />
      </DeckGL>

      {hoverInfo && (
        <div
          style={{
            position: "absolute",
            pointerEvents: "none",
            left: hoverInfo.x + 12,
            top: hoverInfo.y + 12,
            background: "rgba(0,0,0,0.75)",
            color: "white",
            padding: "6px 8px",
            borderRadius: 6,
            fontSize: 12,
            whiteSpace: "pre-line",
          }}
        >
          {hoverInfo.text}
        </div>
      )}

      {filters.showStateNetOverlay && (
        <div
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            State Net Overlay
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 16,
                height: 8,
                background: "rgba(255,165,0,0.6)",
                borderRadius: 4,
              }}
            />
            <span>
              Net gain ({filters.valueType === "predicted" ? "Pred" : "Obs"})
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            <span
              style={{
                width: 16,
                height: 8,
                background: "rgba(30,90,160,0.6)",
                borderRadius: 4,
              }}
            />
            <span>
              Net loss ({filters.valueType === "predicted" ? "Pred" : "Obs"})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function buildChoropleth(summary, metric, stateFilter, valueType) {
  if (!summary) return { map: {}, max: 0 };

  // County choropleth: only inbound is defined in this dataset
  const inbound =
    (valueType === "predicted"
      ? summary.inboundTotalsByCountyPredicted
      : summary.inboundTotalsByCountyObserved) || {};

  const colorMap = {};
  let max = 0;

  Object.keys(inbound).forEach((geoid) => {
    const stateFips = geoid.slice(0, 2);
    if (stateFilter && stateFips !== stateFilter) return;
    const value = inbound[geoid] ?? 0;
    colorMap[geoid] = value;
    if (value > max) max = value;
  });

  return { map: colorMap, max };
}

// Net colors handled by overlay; base county choropleth now uses quantiles

function labelForMetric(metric) {
  if (metric === "in") return "Inbound";
  if (metric === "out") return "Outbound";
  return "Net";
}

function extractBounds(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const processRing = (ring) => {
    ring.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  };

  const processPolygon = (polygon) => {
    polygon.forEach((ring) => processRing(ring));
  };

  if (geometry.type === "Polygon") {
    processPolygon(geometry.coordinates);
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => processPolygon(polygon));
  } else {
    return null;
  }

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function applyViewTransition(prev, next) {
  const epsilon = 1e-4;
  const delta =
    Math.abs(prev.longitude - (next.longitude ?? prev.longitude)) +
    Math.abs(prev.latitude - (next.latitude ?? prev.latitude)) +
    Math.abs(prev.zoom - (next.zoom ?? prev.zoom)) +
    Math.abs(prev.pitch - (next.pitch ?? prev.pitch)) +
    Math.abs(prev.bearing - (next.bearing ?? prev.bearing));

  if (delta < epsilon) return prev;

  return {
    ...prev,
    ...next,
    transitionDuration: 800,
    transitionInterpolator: new FlyToInterpolator(),
  };
}
