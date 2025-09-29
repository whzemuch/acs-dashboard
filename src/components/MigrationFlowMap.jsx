import { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { Map as ReactMap } from "react-map-gl";
import { ArcLayer, GeoJsonLayer } from "@deck.gl/layers";
import { FlyToInterpolator, WebMercatorViewport } from "@deck.gl/core";

import { getFlows as getFlowsWorker } from "../data/flowService";
import { getCountyMetadata, getYearSummary } from "../data/dataProvider";
import { useDashboardStore } from "../store/dashboardStore";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const COUNTIES_GEOJSON = `${
  import.meta.env.BASE_URL
}data/geo/cb_2018_us_county_5m_boundaries.geojson`;
const STATES_GEOJSON = `${
  import.meta.env.BASE_URL
}data/geo/cb_2018_us_state_5m_boundaries.geojson`;

const INITIAL_VIEW_STATE = {
  longitude: -98,
  latitude: 39,
  zoom: 3.4,
  pitch: 50,
  bearing: -20,
};

const IN_COLOR = [130, 202, 250, 200];
const OUT_COLOR = [255, 140, 0, 200];
const NET_COLOR = [30, 90, 160, 200];
// Colorblind-friendly diverging palette (blue = gain, orange = loss)
const NET_GAIN_COLOR = [115, 96, 210, 200];
const NET_LOSS_COLOR = [166, 54, 98, 200];
const NET_NEUTRAL_COLOR = [128, 128, 128, 200];
const COUNTY_HIGHLIGHT_FILL = [0, 150, 136, 160];
const COUNTY_HIGHLIGHT_LINE = [0, 120, 110, 220];
const STATE_HIGHLIGHT_FILL = [168, 208, 255, 90];
const STATE_COUNTY_FILL = [205, 225, 255, 110];
const STATE_HIGHLIGHT_LINE = [30, 90, 160, 220];

export default function MigrationFlowMap({ forceEnabled = false }) {
  const initStore = useDashboardStore((s) => s.init);
  const ready = useDashboardStore((s) => s.ready);
  const filters = useDashboardStore((s) => s.filters);
  const viewMode = filters.viewMode ?? "choropleth";
  const isFlowMode = forceEnabled || viewMode === "flow";
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [countiesGeo, setCountiesGeo] = useState(null);
  const [statesGeo, setStatesGeo] = useState(null);
  const [arcs, setArcs] = useState([]);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [summaryData, setSummaryData] = useState(null);

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
    if (!ready || !isFlowMode) {
      setArcs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getFlowsWorker(filters);
        if (!cancelled) setArcs(data);
      } catch (error) {
        console.error("Failed to load flows", error);
        if (!cancelled) setArcs([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, filters, isFlowMode]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const summary = await getYearSummary(filters.year);
        if (!cancelled) setSummaryData(summary);
      } catch (error) {
        console.error("Failed to load yearly summary", error);
        if (!cancelled) setSummaryData(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, filters.year]);

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

  const normalizedCounty = filters.county ? normalizeGeoid(filters.county) : null;
  const normalizedState = filters.state ? normalizeState(filters.state) : null;

  const arcLayer = useMemo(() => {
    if (!arcs.length) return null;
    const { metric } = filters;

    const inboundTotals = summaryData?.inboundTotals ?? {};
    const outboundTotals = summaryData?.outboundTotals ?? {};

    const getNetColorForGeoid = (geoid) => {
      const inbound = inboundTotals[geoid] ?? 0;
      const outbound = outboundTotals[geoid] ?? 0;
      const net = inbound - outbound;

      if (net > 0.01) return NET_GAIN_COLOR;
      if (net < -0.01) return NET_LOSS_COLOR;
      return NET_NEUTRAL_COLOR;
    };

    const getEndpointColor = (endpoint) => {
      if (metric !== "net") return () => getArcColor(metric);
      return (d) => {
        const geoid = endpoint === "origin" ? d.origin : d.dest;
        return getNetColorForGeoid(geoid);
      };
    };

    return new ArcLayer({
      id: "migration-arcs",
      data: arcs,
      pickable: true,
      getSourcePosition: (d) => d.originPosition,
      getTargetPosition: (d) => d.destPosition,
      getWidth: (d) => Math.max(0.4, Math.sqrt(d.flow) * 0.15),
      getSourceColor: getEndpointColor("origin"),
      getTargetColor: getEndpointColor("dest"),
      onHover: ({ x, y, object }) => {
        if (!object) {
          setHoverInfo(null);
          return;
        }

        const originMeta = countyLookup.get(object.origin);
        const destMeta = countyLookup.get(object.dest);
        const inboundTotals = summaryData?.inboundTotals ?? {};
        const outboundTotals = summaryData?.outboundTotals ?? {};
        const destIn = inboundTotals[object.dest] ?? 0;
        const destOut = outboundTotals[object.dest] ?? 0;
        const destNet = destIn - destOut;
        const originIn = inboundTotals[object.origin] ?? 0;
        const originOut = outboundTotals[object.origin] ?? 0;
        const originNet = originIn - originOut;

        const lines = [
          `${originMeta?.name ?? object.origin}, ${
            originMeta?.stateName ?? originMeta?.state ?? ""
          } → ${destMeta?.name ?? object.dest}, ${
            destMeta?.stateName ?? destMeta?.state ?? ""
          }`,
          `Slice Flow: ${object.flow.toFixed(1)}`,
          `Destination In: ${destIn.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`,
          `Destination Out: ${destOut.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`,
          `Destination Net: ${destNet.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`,
          `Origin In: ${originIn.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`,
          `Origin Out: ${originOut.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`,
          `Origin Net: ${originNet.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`,
        ];

        if (object.age && object.age !== "all")
          lines.push(`Age: ${object.age}`);
        if (object.income && object.income !== "all")
          lines.push(`Income: ${object.income}`);
        if (object.education && object.education !== "all")
          lines.push(`Education: ${object.education}`);

        setHoverInfo({ x, y, text: lines.join("\n") });
      },
    });
  }, [
    arcs,
    filters,
    countyLookup,
    summaryData,
  ]);

  const countyLayer = useMemo(() => {
    if (!countiesGeo) return null;
    const selectedCounty = normalizedCounty;
    return new GeoJsonLayer({
      id: "county-boundaries",
      data: countiesGeo,
      filled: true,
      stroked: true,
      getFillColor: (feature) => {
        const geoid = feature.properties.GEOID;
        if (selectedCounty && geoid === selectedCounty) {
          return COUNTY_HIGHLIGHT_FILL;
        }
        if (normalizedState && feature.properties.STATEFP !== normalizedState) {
          return [230, 230, 230, 40];
        }
        if (normalizedState && feature.properties.STATEFP === normalizedState) {
          return STATE_COUNTY_FILL;
        }
        return [230, 230, 230, 80];
      },
      getLineColor: (feature) => {
        const geoid = feature.properties.GEOID;
        if (selectedCounty && geoid === selectedCounty) {
          return COUNTY_HIGHLIGHT_LINE;
        }
        if (normalizedState && feature.properties.STATEFP === normalizedState) {
          return [120, 120, 120, 200];
        }
        return [120, 120, 120, 160];
      },
      lineWidthUnits: "pixels",
      getLineWidth: (feature) => {
        const geoid = feature.properties.GEOID;
        if (selectedCounty && geoid === selectedCounty) return 2.4;
        if (normalizedState && feature.properties.STATEFP === normalizedState) return 1.4;
        return 0.75;
      },
      pickable: true,
      updateTriggers: {
        getFillColor: [selectedCounty, normalizedState],
        getLineColor: [selectedCounty, normalizedState],
        getLineWidth: [selectedCounty, normalizedState],
      },
      onHover: (info) => {
        if (!info.object) {
          setHoverInfo(null);
          return;
        }
        const text = buildCountyHoverText(
          info.object.properties.GEOID,
          countyLookup,
          summaryData,
          filters,
        );
        setHoverInfo({ x: info.x, y: info.y, text });
      },
    });
  }, [
    countiesGeo,
    normalizedCounty,
    normalizedState,
    countyLookup,
    summaryData,
  ]);

  const stateLayer = useMemo(() => {
    if (!statesGeo) return null;
    return new GeoJsonLayer({
      id: "state-boundaries",
      data: statesGeo,
      filled: true,
      stroked: true,
      getFillColor: (feature) =>
        normalizedState && feature.properties.STATEFP === normalizedState
          ? STATE_HIGHLIGHT_FILL
          : [0, 0, 0, 0],
      getLineColor: (feature) =>
        normalizedState && feature.properties.STATEFP === normalizedState
          ? STATE_HIGHLIGHT_LINE
          : [60, 60, 60, 200],
      lineWidthUnits: "pixels",
      getLineWidth: (feature) =>
        normalizedState && feature.properties.STATEFP === normalizedState ? 2.5 : 1.2,
      updateTriggers: {
        getFillColor: [normalizedState],
        getLineColor: [normalizedState],
        getLineWidth: [normalizedState],
      },
    });
  }, [statesGeo, normalizedState]);

  const layers = useMemo(
    () => [stateLayer, countyLayer, arcLayer].filter(Boolean),
    [stateLayer, countyLayer, arcLayer]
  );

  useEffect(() => {
    if (!ready) return;

    let targetFeature = null;
    const normalizedCounty = filters.county ? normalizeGeoid(filters.county) : null;
    if (normalizedCounty && countyFeatureMap.has(normalizedCounty)) {
      targetFeature = countyFeatureMap.get(normalizedCounty);
    } else if (normalizedState && stateFeatureMap.has(normalizedState)) {
      targetFeature = stateFeatureMap.get(normalizedState);
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

      const padding = normalizedCounty ? 60 : 140;
      let { longitude, latitude, zoom } = viewport.fitBounds(bounds, { padding });
      zoom = Math.min(zoom, normalizedCounty ? 8 : 6);

      return applyViewTransition(prev, { longitude, latitude, zoom });
    });
  }, [
    ready,
    filters.county,
    normalizedState,
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

function getArcColor(metric) {
  if (metric === "in") return IN_COLOR;
  if (metric === "out") return OUT_COLOR;
  return NET_COLOR;
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

function normalizeGeoid(id) {
  if (!id) return "";
  const value = typeof id === "number" ? id.toString() : String(id);
  return value.padStart(5, "0");
}

function normalizeState(id) {
  if (!id) return "";
  const value = typeof id === "number" ? id.toString() : String(id);
  return value.padStart(2, "0");
}

function buildCountyHoverText(geoid, countyLookup, summary, filters) {
  const meta = countyLookup.get(geoid) || {};
  const name = meta.name ?? geoid;
  const stateName = meta.stateName ?? meta.state ?? "";
  const inboundTotals = summary?.inboundTotals ?? {};
  const outboundTotals = summary?.outboundTotals ?? {};
  const inbound = inboundTotals[geoid] ?? 0;
  const outbound = outboundTotals[geoid] ?? 0;
  const net = inbound - outbound;

  const lines = [
    `${name}, ${stateName} (GEOID: ${geoid})`,
    `Inbound: ${inbound.toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
    `Outbound: ${outbound.toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
    `Net: ${net.toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
  ];

  if (filters.age && filters.age !== "all") lines.push(`Age: ${filters.age}`);
  if (filters.income && filters.income !== "all")
    lines.push(`Income: ${filters.income}`);
  if (filters.education && filters.education !== "all")
    lines.push(`Education: ${filters.education}`);

  return lines.join("\n");
}
