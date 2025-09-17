// Find education stats for a given PUMA code
export function findStatsForPUMA(puma, data) {
  return data?.find((d) => String(d.PUMA) === String(puma));
}

// Default initial map view
export function getInitialViewState() {
  return {
    longitude: -95,
    latitude: 37,
    zoom: 3,
    pitch: 0,
    bearing: 0,
  };
}

// Return plain data describing tooltip content
export function formatPUMAContent(object, eduData) {
  const stats = findStatsForPUMA(object.properties.PUMA, eduData);
  const pumaCode = object.properties.PUMA;

  return {
    name: object.properties.name,
    stats,
    pumaCode,
  };
}
