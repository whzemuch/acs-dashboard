// src/components/ChoroplethMap.jsx
import { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { Map as ReactMap } from "react-map-gl";
import { GeoJsonLayer } from "@deck.gl/layers";
import { FlyToInterpolator, WebMercatorViewport } from "@deck.gl/core";

import { useDashboardStore } from "../store/dashboardStore";
import { getCountyMetadata, getYearSummary } from "../data/dataProvider";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const COUNTIES_GEOJSON = `${import.meta.env.BASE_URL}data/geo/cb_2018_us_county_5m_boundaries.geojson`;
const STATES_GEOJSON = `${import.meta.env.BASE_URL}data/geo/cb_2018_us_state_5m_boundaries.geojson`;
const INITIAL_VIEW_STATE = { longitude: -98, latitude: 39, zoom: 3.4 };

export default function ChoroplethMap() {
  const initStore = useDashboardStore((s) => s.init);
  const ready = useDashboardStore((s) => s.ready);
  const filters = useDashboardStore((s) => s.filters);

  const [countiesGeo, setCountiesGeo] = useState(null);
  const [statesGeo, setStatesGeo] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [colorData, setColorData] = useState({ map: {}, max: 0 });
  const [summaryData, setSummaryData] = useState(null);
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
    let cancelled = false;

    (async () => {
      try {
        const summary = await getYearSummary(filters.year);
        const map = buildChoropleth(summary, filters.metric, filters.state);
        if (!cancelled) {
          setSummaryData(summary);
          setColorData(map);
        }
      } catch (error) {
        console.error("Failed to build choropleth data", error);
        if (!cancelled) {
          setSummaryData(null);
          setColorData({ map: {}, max: 0 });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, filters.year, filters.metric, filters.state]);

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
    return new GeoJsonLayer({
      id: `counties-${filters.year}-${filters.state ?? "all"}`,
      data: countiesGeo,
      filled: true,
      stroked: true,
      getFillColor: (feature) => {
        const geoid = feature.properties.GEOID;
        const value = colorData.map[geoid] ?? 0;
        const fill = getFillColor(value, colorData.max, filters.metric);
        if (filters.state && feature.properties.STATEFP !== filters.state) {
          return [230, 230, 230, 40];
        }
        return fill;
      },
      getLineColor: [100, 100, 100, 150],
      lineWidthMinPixels: 0.5,
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
        const value = colorData.map[GEOID] ?? 0;
        const inboundTotals = summaryData?.inboundTotals ?? {};
        const outboundTotals = summaryData?.outboundTotals ?? {};
        const inbound = inboundTotals[GEOID] ?? 0;
        const outbound = outboundTotals[GEOID] ?? 0;
        const net = inbound - outbound;
        const lines = [
          `${NAME}, ${stateName} (GEOID: ${GEOID})`,
        ];

        const metricLabel = labelForMetric(filters.metric);
        lines.push(
          `${metricLabel}: ${value.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`,
        );

        if (filters.metric !== "in") {
          lines.push(
            `Inbound: ${inbound.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}`,
          );
        }

        if (filters.metric !== "out") {
          lines.push(
            `Outbound: ${outbound.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}`,
          );
        }

        if (filters.metric !== "net") {
          lines.push(
            `Net: ${net.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}`,
          );
        }
        if (filters.age && filters.age !== "all") lines.push(`Age: ${filters.age}`);
        if (filters.income && filters.income !== "all")
          lines.push(`Income: ${filters.income}`);
        if (filters.education && filters.education !== "all")
          lines.push(`Education: ${filters.education}`);
        setHoverInfo({ x: info.x, y: info.y, text: lines.join("\n") });
      },
    });
  }, [
    countiesGeo,
    colorData,
    filters,
    countyLookup,
    summaryData,
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
    () => [stateLayer, countyLayer].filter(Boolean),
    [stateLayer, countyLayer],
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
      let { longitude, latitude, zoom } = viewport.fitBounds(bounds, { padding });
      zoom = Math.min(zoom, filters.county ? 8 : 6);

      return applyViewTransition(prev, { longitude, latitude, zoom });
    });
  }, [
    ready,
    filters.county,
    filters.state,
    countyFeatureMap,
    stateFeatureMap,
  ]);

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
    </div>
  );
}

function buildChoropleth(summary, metric, stateFilter) {
  if (!summary) return { map: {}, max: 0 };

  const inbound = summary.inboundTotals ?? {};
  const outbound = summary.outboundTotals ?? {};

  const colorMap = {};
  let max = 0;

  const geoidSet = new Set([
    ...Object.keys(inbound),
    ...Object.keys(outbound),
  ]);

  geoidSet.forEach((geoid) => {
    const stateFips = geoid.slice(0, 2);
    if (stateFilter && stateFips !== stateFilter) return;
    const inValue = inbound[geoid] ?? 0;
    const outValue = outbound[geoid] ?? 0;
    let value = 0;
    if (metric === "in") value = inValue;
    else if (metric === "out") value = outValue;
    else value = inValue - outValue;

    colorMap[geoid] = value;
    const magnitude = metric === "net" ? Math.abs(value) : value;
    if (magnitude > max) max = magnitude;
  });

  return { map: colorMap, max };
}

function getFillColor(value, max, metric) {
  if (!max) return [240, 240, 240, 120];

  if (metric === "net") {
    if (value === 0) return [240, 240, 240, 120];
    const intensity = Math.min(1, Math.abs(value) / max);
    if (value > 0) {
      return [255, 180 - intensity * 120, 0, 200];
    }
    return [50, 120 + intensity * 60, 220, 200];
  }

  const intensity = Math.min(1, value / max);
  return [255, 180 - intensity * 120, 0, 200];
}

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
