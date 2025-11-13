import { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { Map as ReactMap } from "react-map-gl";
import { ArcLayer, GeoJsonLayer, PathLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { FlyToInterpolator, WebMercatorViewport } from "@deck.gl/core";
import { scaleLog } from "d3-scale";
import centerOfMass from "@turf/center-of-mass";
import pointOnFeature from "@turf/point-on-feature";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

import { getFlows as getFlowsWorker } from "../data/flowServiceShap";
import {
  getCountyMetadata,
  getSummary,
  getShapForState,
  getShapSchema,
} from "../data/dataProviderShap";
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

const ARC_BLACK = [0, 0, 0, 230];
const IN_COLOR = [130, 202, 250, 220];
const OUT_COLOR = [255, 140, 0, 220];
const NET_COLOR = [30, 90, 160, 200];
// Colorblind-friendly diverging palette (blue = gain, orange = loss)
const NET_GAIN_COLOR = [41, 128, 185, 200]; // Blue - positive net flow (gain)
const NET_LOSS_COLOR = [230, 126, 34, 200]; // Orange - negative net flow (loss)
const NET_NEUTRAL_COLOR = [128, 128, 128, 200];
const COUNTY_HIGHLIGHT_FILL = [0, 150, 136, 160];
const COUNTY_HIGHLIGHT_LINE = [0, 120, 110, 220];
const STATE_HIGHLIGHT_FILL = [168, 208, 255, 90];
const STATE_COUNTY_FILL = [205, 225, 255, 110];
const STATE_HIGHLIGHT_LINE = [30, 90, 160, 220];

// Friendly labels for international/region origin codes
const REGION_LABELS = {
  ASI: "Asia",
  EUR: "Europe",
  CAM: "Central America",
  AFR: "Africa",
  SAM: "South America",
  NAM: "North America (non‑US)",
  CAR: "Caribbean",
  OCE: "Oceania",
  ISL: "Islands",
};

export default function MigrationFlowMap({
  forceEnabled = false,
  side = null,
}) {
  const initStore = useDashboardStore((s) => s.init);
  const ready = useDashboardStore((s) => s.ready);

  // Use different filters based on side (for comparison view)
  // Subscribe directly to the filter object to ensure reactivity
  const filters = useDashboardStore((s) =>
    side === "left"
      ? s.leftFilters
      : side === "right"
      ? s.rightFilters
      : s.filters
  );

  const viewMode = filters.viewMode ?? "choropleth";
  // If side is provided (comparison mode), always show flows
  const isFlowMode =
    side !== null ||
    forceEnabled ||
    viewMode === "flow" ||
    viewMode === "comparison";
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [countiesGeo, setCountiesGeo] = useState(null);
  const [statesGeo, setStatesGeo] = useState(null);
  const [arcs, setArcs] = useState([]);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [summaryData, setSummaryData] = useState(null);

  // Use different selectedArc based on side
  const setMainSelectedArc = useDashboardStore((s) => s.setSelectedArc);
  const setLeftSelectedArc = useDashboardStore((s) => s.setLeftSelectedArc);
  const setRightSelectedArc = useDashboardStore((s) => s.setRightSelectedArc);
  const setSelectedArc =
    side === "left"
      ? setLeftSelectedArc
      : side === "right"
      ? setRightSelectedArc
      : setMainSelectedArc;

  const mainSelectedArc = useDashboardStore((s) => s.selectedArc);
  const leftSelectedArc = useDashboardStore((s) => s.leftSelectedArc);
  const rightSelectedArc = useDashboardStore((s) => s.rightSelectedArc);
  const selectedArc =
    side === "left"
      ? leftSelectedArc
      : side === "right"
      ? rightSelectedArc
      : mainSelectedArc;

  const [featureShapMap, setFeatureShapMap] = useState(null);
  const [featureThreshold, setFeatureThreshold] = useState(0);

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

  // Fetch flows only when relevant flow filters change (avoid refetch on feature slider changes)
  const flowMetric = filters.metric;
  const flowState = filters.state;
  const flowCounty = filters.county;
  const flowValueType = filters.valueType;
  const flowMinFlow = filters.minFlow;
  const flowTopN = filters.enableTopN ? filters.topN : 999999; // Use large number when topN is disabled

  // Debug logging
  useEffect(() => {
    console.log(
      `[MigrationFlowMap ${side || "main"}] minFlow changed:`,
      flowMinFlow
    );
  }, [flowMinFlow, side]);

  useEffect(() => {
    if (!ready || !isFlowMode) {
      setArcs([]);
      return;
    }
    console.log(
      `[MigrationFlowMap ${side || "main"}] Fetching flows with minFlow:`,
      flowMinFlow
    );
    let cancelled = false;
    (async () => {
      try {
        // Fetch more flows if we need to filter out instate (for both inbound and outbound)
        const shouldFilterOutstate = flowState && filters.enableTopN;
        const fetchCount = shouldFilterOutstate
          ? Math.max(flowTopN * 3, 100)
          : flowTopN;

        const data = await getFlowsWorker({
          metric: flowMetric,
          state: flowState,
          county: flowCounty,
          valueType: flowValueType,
          minFlow: flowMinFlow,
          topN: fetchCount,
        });

        if (!cancelled) {
          console.log(
            `[MigrationFlowMap ${side || "main"}] Received ${data.length} flows`
          );

          // Filter out instate flows when enableTopN is true
          let filteredData = data;
          if (shouldFilterOutstate) {
            const selectedStateCode = flowState;
            const metricLabel = flowMetric === "in" ? "inbound" : "outbound";
            const isInbound = flowMetric === "in";

            filteredData = data
              .filter((f) => {
                // For inbound: filter by origin (exclude origins from same state)
                // For outbound: filter by dest (exclude destinations in same state)
                // Note: origin is 3-digit code (e.g., "001"), dest is 5-digit FIPS (e.g., "01073")
                let checkState;
                if (isInbound) {
                  // Origin is 3-digit: convert to 2-digit by removing leading zero
                  const originCode = f.origin;
                  checkState =
                    originCode.length === 3
                      ? originCode.substring(1, 3)
                      : originCode.substring(0, 2);
                } else {
                  // Dest is 5-digit FIPS: first 2 digits are state code
                  checkState = f.dest.substring(0, 2);
                }
                return checkState !== selectedStateCode;
              })
              .slice(0, flowTopN); // Take top N after filtering

            console.log(
              `[MigrationFlowMap ${side || "main"}] Filtered to ${
                filteredData.length
              } outstate ${metricLabel} flows (excluded instate ${
                isInbound ? "origins" : "destinations"
              })`
            );
          }

          setArcs(filteredData);
        }
      } catch (error) {
        console.error("Failed to load flows", error);
        if (!cancelled) setArcs([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    side,
    isFlowMode,
    flowMetric,
    flowState,
    flowCounty,
    flowValueType,
    flowMinFlow,
    flowTopN,
  ]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const summary = await getSummary();
        if (!cancelled) setSummaryData(summary);
      } catch (error) {
        console.error("Failed to load summary", error);
        if (!cancelled) setSummaryData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const countyLookup = useMemo(() => {
    const map = new Map();
    if (!ready) return map;
    getCountyMetadata().forEach((entry) => map.set(entry.geoid, entry));
    return map;
  }, [ready]);

  const stateNameMap = useMemo(() => {
    const map = new Map();
    if (!ready) return map;
    getCountyMetadata().forEach((entry) => {
      const code = String(entry.state).padStart(2, "0");
      if (!map.has(code)) map.set(code, entry.stateName ?? entry.state);
    });
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
      if (id) {
        // Use center-of-mass with fallback to point-on-feature for an interior label point
        try {
          let pt = null;
          try {
            pt = centerOfMass(feature);
          } catch {}
          let coords = pt?.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2 || !booleanPointInPolygon(pt, feature)) {
            try {
              pt = pointOnFeature(feature);
              coords = pt?.geometry?.coordinates;
            } catch {}
          }
          const stateCentroid = Array.isArray(coords) && coords.length >= 2 ? coords : null;
          map.set(id, { ...feature, centroid: stateCentroid });
        } catch (err) {
          console.warn(`Failed to calculate centroid for state ${id}:`, err);
          map.set(id, { ...feature, centroid: null });
        }
      }
    });
    return map;
  }, [statesGeo]);

  const normalizedCounty = filters.county
    ? normalizeGeoid(filters.county)
    : null;
  const normalizedState = filters.state ? normalizeState(filters.state) : null;

  // Load SHAP for selected feature (state-scoped) and compute threshold over current arcs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isFlowMode || !filters.state || !filters.featureId) {
        if (!cancelled) {
          setFeatureShapMap(null);
        }
        return;
      }
      try {
        const schema = await getShapSchema();
        const idx = Array.isArray(schema)
          ? schema.indexOf(filters.featureId)
          : -1;
        if (idx < 0) {
          if (!cancelled) {
            setFeatureShapMap(null);
          }
          return;
        }
        const shapPayload = await getShapForState(filters.state);
        const rows = shapPayload?.rows || [];
        const map = new Map();
        for (const r of rows) {
          const v = Array.isArray(r.shapValues)
            ? Number(r.shapValues[idx]) || 0
            : 0;
          map.set(r.id, v);
        }
        // Compute percentile threshold over current arcs if requested
        let threshold = 0;
        const q = Math.max(
          0,
          Math.min(100, Number(filters.featureFlowQuantile ?? 0))
        );
        if (q > 0 && arcs.length) {
          const arr = arcs
            .map((a) => Math.abs(map.get(a.id) || 0))
            .filter((v) => v > 0)
            .sort((a, b) => a - b);
          if (arr.length > 0) {
            const ix = Math.min(
              arr.length - 1,
              Math.max(0, Math.floor((q / 100) * (arr.length - 1)))
            );
            threshold = arr[ix] || 0;
          }
        }
        if (!cancelled) {
          setFeatureShapMap(map);
          setFeatureThreshold(threshold);
        }
      } catch (e) {
        if (!cancelled) {
          setFeatureShapMap(null);
          setFeatureThreshold(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isFlowMode,
    filters.state,
    filters.featureId,
    filters.featureFlowQuantile,
    arcs,
  ]);

  const arcLayer = useMemo(() => {
    if (!arcs.length) return null;
    const { metric } = filters;

    const inboundTotalsByCountyObserved =
      summaryData?.inboundTotalsByCountyObserved ?? {};
    const inboundTotalsByCountyPredicted =
      summaryData?.inboundTotalsByCountyPredicted ?? {};
    const inboundTotalsByStateObserved =
      summaryData?.inboundTotalsByStateObserved ?? {};
    const inboundTotalsByStatePredicted =
      summaryData?.inboundTotalsByStatePredicted ?? {};
    const outboundTotalsByStateObserved =
      summaryData?.outboundTotalsByStateObserved ?? {};
    const outboundTotalsByStatePredicted =
      summaryData?.outboundTotalsByStatePredicted ?? {};

    // Build a width scale to increase contrast between flows
    const flows = arcs
      .map((d) => d.flow)
      .filter((v) => Number.isFinite(v) && v > 0);
    const minF = flows.length ? Math.min(...flows) : 0;
    const maxF = flows.length ? Math.max(...flows) : 1;

    // Use logarithmic scale for better arc width distribution
    // Add 1 to avoid log(0), and ensure domain is at least [1, 10]
    const widthScale = scaleLog()
      .domain([Math.max(1, minF || 1), Math.max(10, maxF || 10)])
      .range([2, 12])
      .clamp(true);

    const dimFactor = selectedArc ? 0.2 : 1;

    // Standard ArcLayer for inbound and outbound modes
    const arcColor = metric === "in" ? IN_COLOR : OUT_COLOR;
    let dataForLayer = arcs;

    if (featureShapMap) {
      // Apply percentile threshold only (simple UX)
      if ((filters.featureFlowQuantile ?? 0) > 0 && featureThreshold > 0) {
        dataForLayer = dataForLayer.filter(
          (d) => Math.abs(featureShapMap.get(d.id) || 0) >= featureThreshold
        );
      }
    }
    // Always enforce Min Flow on the client as well for immediate response
    if ((filters.minFlow ?? 0) > 0) {
      const minFClient = Number(filters.minFlow) || 0;
      const beforeFilter = dataForLayer.length;
      dataForLayer = dataForLayer.filter(
        (d) => (Number(d.flow) || 0) >= minFClient
      );
      console.log(
        `[MigrationFlowMap ${
          side || "main"
        }] Client-side minFlow filter: ${minFClient}, arcs: ${beforeFilter} → ${
          dataForLayer.length
        }`
      );
    }

    return new ArcLayer({
      id: "migration-arcs",
      data: dataForLayer,
      pickable: true,
      getSourcePosition: (d) => d.originPosition,
      getTargetPosition: (d) => d.destPosition,
      getWidth: (d) => widthScale(Math.max(1, d.flow)), // Use max(1, flow) for log scale
      widthUnits: "pixels",
      widthMinPixels: 2,
      getSourceColor: () => arcColor,
      getTargetColor: () => arcColor,
      onHover: ({ x, y, object }) => {
        if (!object) {
          setHoverInfo(null);
          return;
        }

        const originLabel = getOriginLabel(object.origin, stateNameMap);
        const destMeta = countyLookup.get(object.dest);
        const destState = object.dest.slice(0, 2).padStart(3, "0");
        const originState2Digit =
          (/^\d+$/.test(object.origin) ? object.origin.slice(0, 2) : null) ||
          object.origin;
        const originState =
          typeof originState2Digit === "string" &&
          originState2Digit.length === 2
            ? originState2Digit.padStart(3, "0")
            : originState2Digit;
        const destIn =
          (filters.valueType === "predicted"
            ? inboundTotalsByCountyPredicted[object.dest]
            : inboundTotalsByCountyObserved[object.dest]) ?? 0;
        const originInState =
          (filters.valueType === "predicted"
            ? inboundTotalsByStatePredicted[originState]
            : inboundTotalsByStateObserved[originState]) ?? 0;
        const originOutState =
          (filters.valueType === "predicted"
            ? outboundTotalsByStatePredicted[originState]
            : outboundTotalsByStateObserved[originState]) ?? 0;
        const destInState =
          (filters.valueType === "predicted"
            ? inboundTotalsByStatePredicted[destState]
            : inboundTotalsByStateObserved[destState]) ?? 0;
        const destOutState =
          (filters.valueType === "predicted"
            ? outboundTotalsByStatePredicted[destState]
            : outboundTotalsByStateObserved[destState]) ?? 0;
        const destNetState = destInState - destOutState;
        const originNetState = originInState - originOutState;

        const lines = [
          `${originLabel} → ${destMeta?.name ?? object.dest}${
            destMeta?.stateName ? ", " + destMeta.stateName : ""
          }`,
          `Observed: ${object.observed.toLocaleString()}  Predicted: ${object.predicted.toLocaleString(
            undefined,
            { maximumFractionDigits: 1 }
          )}`,
          `County In (dest): ${destIn.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`,
          `Dest State Net: ${destNetState.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`,
          `Origin State Net: ${originNetState.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}`,
        ];

        // Append selected feature SHAP if available
        if (featureShapMap && filters.featureId) {
          const shapVal = featureShapMap.get(object.id) || 0;
          const featLabel = prettifyFeature(filters.featureId);
          lines.push(`${featLabel} SHAP: ${shapVal.toFixed(2)}`);
        }

        if (object.age && object.age !== "all")
          lines.push(`Age: ${object.age}`);
        if (object.income && object.income !== "all")
          lines.push(`Income: ${object.income}`);
        if (object.education && object.education !== "all")
          lines.push(`Education: ${object.education}`);

        setHoverInfo({ x, y, text: lines.join("\n") });
      },
      onClick: ({ object }) => {
        if (object) setSelectedArc(object);
      },
      updateTriggers: {
        getWidth: [minF, maxF],
        getSourceColor: [metric, selectedArc?.id],
        getTargetColor: [metric, selectedArc?.id],
      },
    });
  }, [
    arcs,
    filters,
    countyLookup,
    stateNameMap,
    summaryData,
    selectedArc,
    featureShapMap,
    featureThreshold,
    filters.minFlow,
  ]);

  function prettifyFeature(key) {
    const k = String(key || "").replace(/^shap_/, "");
    return k
      .split("_")
      .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
      .join(" ");
  }

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
        if (normalizedState && feature.properties.STATEFP === normalizedState)
          return 1.4;
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
          filters
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
        normalizedState && feature.properties.STATEFP === normalizedState
          ? 2.5
          : 1.2,
      updateTriggers: {
        getFillColor: [normalizedState],
        getLineColor: [normalizedState],
        getLineWidth: [normalizedState],
      },
    });
  }, [statesGeo, normalizedState]);

  const heatmapLayer = useMemo(() => {
    if (!arcs.length || !filters.showHeatmap) return null;
    const points = arcs.map((a) => ({
      position: a.destPosition,
      weight: a.flow,
    }));
    return new HeatmapLayer({
      id: "dest-heatmap",
      data: points,
      getPosition: (d) => d.position,
      getWeight: (d) => d.weight,
      radiusPixels: 40,
      intensity: 1,
      threshold: 0.05,
    });
  }, [arcs, filters.showHeatmap]);

  // Highlight selected arc with bright yellow overlay - highly visible on all backgrounds
  const selectedArcLayer = useMemo(() => {
    if (!selectedArc) return null;

    return new ArcLayer({
      id: "selected-arc-highlight",
      data: [selectedArc],
      getSourcePosition: (d) => d.originPosition,
      getTargetPosition: (d) => d.destPosition,
      getWidth: 8, // Wider than normal arcs
      widthUnits: "pixels",
      widthMinPixels: 6,
      getSourceColor: [255, 255, 0, 255], // Bright yellow - visible on light map
      getTargetColor: [255, 255, 0, 255],
      pickable: false, // Don't interfere with picking
    });
  }, [selectedArc]);

  const layers = useMemo(() => {
    const arcLayers = Array.isArray(arcLayer)
      ? arcLayer
      : arcLayer
      ? [arcLayer]
      : [];
    const sel = Array.isArray(selectedArcLayer)
      ? selectedArcLayer
      : selectedArcLayer
      ? [selectedArcLayer]
      : [];
    return [stateLayer, countyLayer, heatmapLayer, ...arcLayers, ...sel].filter(
      Boolean
    );
  }, [stateLayer, countyLayer, heatmapLayer, arcLayer, selectedArcLayer]);

  useEffect(() => {
    if (!ready) return;

    let targetFeature = null;
    const normalizedCounty = filters.county
      ? normalizeGeoid(filters.county)
      : null;
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
      let { longitude, latitude, zoom } = viewport.fitBounds(bounds, {
        padding,
      });
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
        pickingRadius={12}
        onClick={(info) => {
          // If clicking on an arc, do nothing (let arc layer's onClick handle it)
          if (info && info.layer && info.layer.id === "migration-arcs") {
            return;
          }
          // Otherwise, clear the selection (clicked on map background or other layers)
          setSelectedArc(null);
        }}
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
    `Inbound: ${inbound.toLocaleString(undefined, {
      maximumFractionDigits: 1,
    })}`,
    `Outbound: ${outbound.toLocaleString(undefined, {
      maximumFractionDigits: 1,
    })}`,
    `Net: ${net.toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
  ];

  if (filters.age && filters.age !== "all") lines.push(`Age: ${filters.age}`);
  if (filters.income && filters.income !== "all")
    lines.push(`Income: ${filters.income}`);
  if (filters.education && filters.education !== "all")
    lines.push(`Education: ${filters.education}`);

  return lines.join("\n");
}

function getOriginLabel(originCode, stateNameMap) {
  if (!originCode) return "";
  const s = String(originCode).trim();
  // Numeric US state code (often 3-digit like '048'); map to last 2 digits
  if (/^\d+$/.test(s)) {
    const fips2 = s.slice(-2).padStart(2, "0");
    return stateNameMap.get(fips2) || fips2;
  }
  // Region label
  return REGION_LABELS[s] || s;
}
