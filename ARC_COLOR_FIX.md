# Arc Color Fix for Flow View

## Problem

In the Flow View with **Net metric** selected:

- **Expected**: Purple arcs for net gain states, red arcs for net loss states (matching legend)
- **Actual**: All arcs were appearing black/dark, not matching the legend colors

## Root Cause Analysis

### 1. Color Constants (Correct)

```javascript
const NET_GAIN_COLOR = [115, 96, 210, 200]; // Purple
const NET_LOSS_COLOR = [166, 54, 98, 200]; // Red/Magenta
```

### 2. Legend Panel (Correct)

```jsx
<LegendRow color="rgba(115, 96, 210, 1)" label="Net gain" />  // Purple
<LegendRow color="rgba(166, 54, 98, 1)" label="Net loss" />   // Red
```

### 3. Arc Rendering Logic (Had Issues)

**The Problem:**

- Net mode correctly split arcs into `gain` and `loss` arrays
- Created two `GreatCircleLayer` instances with correct colors
- BUT: The non-net mode `ArcLayer` used complex `getEndpointColor()` logic that:
  - Called `getNetColorForEndpoint()` for net mode
  - This function tried to determine color per endpoint, creating gradient effects
  - The gradient approach mixed colors incorrectly, making arcs appear dark/black

**Additional Issue:**

- The `getArcColor()` fallback returned `NET_COLOR = [30, 90, 160, 200]` (dark blue)
- This was being used when the endpoint color logic failed

## Solution

### 1. Simplified Net Mode Arc Classification

```javascript
// Classify each arc by destination state's net migration
for (const a of arcs) {
  // Get destination state code (first 2 digits of 5-digit county FIPS)
  const destState = a.dest.slice(0, 2);
  const inbound = inState?.[destState] ?? 0;
  const outbound = outState?.[destState] ?? 0;
  const net = inbound - outbound;

  // Positive net = gain (purple), negative net = loss (red)
  if (net >= 0) {
    gain.push(a);
  } else {
    loss.push(a);
  }
}
```

### 2. Created Two Distinct Layers for Net Mode

```javascript
const gainLayer = new GreatCircleLayer({
  id: "net-gain-arcs",
  data: gain,
  getColor: () => NET_GAIN_COLOR, // Solid purple
});

const lossLayer = new GreatCircleLayer({
  id: "net-loss-arcs",
  data: loss,
  getColor: () => NET_LOSS_COLOR, // Solid red
});

return [gainLayer, lossLayer];
```

### 3. Simplified Inbound/Outbound Mode Colors

```javascript
// For inbound and outbound modes, use standard ArcLayer with single color
const arcColor = metric === "in" ? IN_COLOR : OUT_COLOR;

return new ArcLayer({
  getSourceColor: arcColor, // Solid color, no gradients
  getTargetColor: arcColor,
});
```

### 4. Removed Unnecessary Helper Functions

- Deleted `getArcColor()` - no longer needed
- Deleted `getNetColorForEndpoint()` - overcomplicated the logic
- Deleted `getEndpointColor()` - not needed with simplified approach

## Key Changes

1. **Net Mode**: Arcs are now classified by **destination state's net migration** (inbound - outbound)

   - `net >= 0` → Purple (NET_GAIN_COLOR)
   - `net < 0` → Red (NET_LOSS_COLOR)

2. **Inbound/Outbound Modes**: Use solid colors throughout the arc

   - Inbound: Light blue (`IN_COLOR`)
   - Outbound: Orange (`OUT_COLOR`)

3. **Tooltip Enhancement**: Added `(gain)` or `(loss)` label to Dest State Net in tooltips for clarity

## Result

✅ **Net mode arcs now display correctly:**

- Purple arcs for states with net population gain
- Red arcs for states with net population loss
- Colors match the legend exactly

✅ **Inbound/Outbound modes are simplified:**

- Solid colors throughout each arc
- No confusing gradients

✅ **Legend is accurate:**

- Legend colors match actual arc colors on the map
- Clear distinction between gain and loss

## Testing

To verify the fix:

1. Select **Flow View** → **Metric: Net**
2. Hover over arcs to see state net values
3. Verify purple arcs go to net-gain states
4. Verify red arcs go to net-loss states
5. Check that legend colors match arc colors

## Technical Notes

- **Net calculation**: Based on state-level totals (not county-level) since the dataset is state→county flows
- **Arc classification**: Each arc inherits the color of its **destination state's** net migration status
- **Layer ordering**: Both gain and loss layers are rendered together; no z-fighting issues since they contain different arcs
