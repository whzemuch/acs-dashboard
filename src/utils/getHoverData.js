// src/utils/renderHoverInfo.js

/**
 * Decide how hover info should be rendered (popup vs tooltip).
 * Returns an object with type, position, and content — not JSX.
 */
export function getHoverRenderData(hoverInfo, options = {}) {
  const { offset = [10, 10] } = options;

  if (!hoverInfo) return null;

  const obj = hoverInfo.object || hoverInfo;
  if (!obj) return null;

  // If coordinate (lng/lat) exists → use map popup
  if (hoverInfo.coordinate) {
    const [lng, lat] = hoverInfo.coordinate;
    return {
      type: "popup",
      longitude: lng,
      latitude: lat,
      content: obj,
    };
  }

  // Otherwise, fallback to screen-positioned tooltip
  if (hoverInfo.x != null && hoverInfo.y != null) {
    return {
      type: "tooltip",
      x: hoverInfo.x + offset[0],
      y: hoverInfo.y + offset[1],
      content: obj,
    };
  }

  return null;
}
