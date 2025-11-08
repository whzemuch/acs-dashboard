# Arc Selection Highlighting - Simplified Solution

## Problem

The previous approach of modifying colors for all arcs on selection was inefficient and complex, requiring conditional logic in every arc's color calculation.

## Solution: Overlay Highlight Layer

Instead of changing the colors of existing arcs, we now use a **dedicated highlight layer** that renders on top:

### How It Works

1. **Base Arcs (Always Original Colors)**

   - All arcs always render with their original colors
   - Net mode: purple (gain) or red (loss)
   - Inbound mode: blue
   - Outbound mode: orange
   - No conditional logic based on selection

2. **Highlight Layer (Only for Selected Arc)**
   - When an arc is clicked, a separate `ArcLayer` is created
   - This layer renders a bright white arc on top of the selected arc
   - The white overlay makes the selected arc stand out
   - When nothing is selected, this layer is `null` and doesn't render

### Code Changes

#### Before (Complex)

```javascript
getSourceColor: (d) => {
  if (!selectedArc) return arcColor;
  if (d.id === selectedArc.id) return arcColor;
  const alpha = arcColor[3] * dimFactor;
  return [128, 128, 128, alpha]; // Grey out non-selected
};
```

#### After (Simple)

```javascript
// Base layer - always original color
getSourceColor: () => arcColor,

// Separate highlight layer
const selectedArcLayer = useMemo(() => {
  if (!selectedArc) return null;
  return new ArcLayer({
    id: "selected-arc-highlight",
    data: [selectedArc],
    getWidth: 8, // Wider than normal
    getSourceColor: [255, 255, 255, 255], // Bright white
    getTargetColor: [255, 255, 255, 255],
    pickable: false,
  });
}, [selectedArc]);
```

### Benefits

1. **Performance**: No need to recalculate colors for all arcs on selection
2. **Simplicity**: Each layer has a single, constant color
3. **Clarity**: Highlight layer code is isolated and easy to understand
4. **Flexibility**: Easy to adjust highlight style (color, width, opacity)

### Layer Ordering

Layers render in order:

1. State boundaries (bottom)
2. County boundaries
3. Heatmap (if enabled)
4. Arc layers (with original colors)
5. Highlight layer (top) - only when arc is selected

This ensures the white highlight always appears on top of the selected arc.

### Testing

1. **No Selection**: All arcs show their original colors (purple/red/blue/orange)
2. **Click Arc**: A bright white overlay appears on the clicked arc
3. **Click Background**: White overlay disappears, all arcs return to normal
4. **Different Modes**: Highlight works consistently in Net, Inbound, and Outbound modes

### Performance Impact

- Before: Every arc recalculates color on every render when selection changes
- After: Only the highlight layer updates (1 arc) when selection changes
- With 1000s of arcs, this is a significant performance improvement
