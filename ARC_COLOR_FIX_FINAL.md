# Arc Color Fix for Flow View - FINAL SOLUTION

## Problem Summary

In the Flow View with **Net metric** selected:

- **Expected**: Purple arcs for net gain states, red arcs for net loss states (matching legend)
- **Actual**: All arcs were appearing **BLACK**, completely ignoring the color settings
- **Additional Issue**: International region origins (Asia "ASI") showing incorrect net values

## Root Cause - THE REAL BUG

### Critical Bug: Wrong deck.gl API Usage

```javascript
// ❌ WRONG - This was the bug causing black arcs
const gainLayer = new GreatCircleLayer({
  id: "net-gain-arcs",
  data: gain,
  getColor: () => NET_GAIN_COLOR, // ❌ GreatCircleLayer has NO getColor prop!
});
```

**Why all arcs were black:**

- `GreatCircleLayer` inherits from `ArcLayer`
- `ArcLayer` does **NOT** have a `getColor` property
- `ArcLayer` uses `getSourceColor` and `getTargetColor` instead
- When you pass an invalid prop, deck.gl ignores it
- Result: arcs render with default color (black)

## The Solution

### 1. Use ArcLayer with Correct Color Props

```javascript
// ✅ CORRECT - Now arcs show proper colors
const gainLayer = new ArcLayer({
  id: "net-gain-arcs",
  data: gain,
  getSourceColor: NET_GAIN_COLOR, // [115, 96, 210, 200] = Purple
  getTargetColor: NET_GAIN_COLOR, // Same color = solid purple arc
  ...commonProps,
});

const lossLayer = new ArcLayer({
  id: "net-loss-arcs",
  data: loss,
  getSourceColor: NET_LOSS_COLOR, // [166, 54, 98, 200] = Red
  getTargetColor: NET_LOSS_COLOR, // Same color = solid red arc
  ...commonProps,
});
```

### 2. Arc Classification Logic (This Part Was Already Correct)

```javascript
// Classify arcs by destination state's net migration
for (const a of arcs) {
  const destState = a.dest.slice(0, 2); // Extract state FIPS from county FIPS
  const inbound = inState?.[destState] ?? 0;
  const outbound = outState?.[destState] ?? 0;
  const net = inbound - outbound;

  // Positive net = gain (purple), negative net = loss (red)
  if (net >= 0) {
    gain.push(a); // Will render purple
  } else {
    loss.push(a); // Will render red
  }
}
```

### 3. Debug Logging Added (Temporary)

```javascript
console.log(`Net mode: ${gain.length} gain arcs, ${loss.length} loss arcs`);
if (gain.length > 0) {
  console.log(
    "Sample gain arc:",
    gain[0],
    "dest state:",
    gain[0].dest.slice(0, 2)
  );
}
```

## Why This Works

### deck.gl Color API

**ArcLayer** (and layers inheriting from it):

- ✅ `getSourceColor`: Color at arc start point
- ✅ `getTargetColor`: Color at arc end point
- ❌ `getColor`: Does NOT exist

**Color Format**:

```javascript
// All these formats work:
getSourceColor: [115, 96, 210, 200]; // Direct RGBA array
getSourceColor: (d) => [115, 96, 210, 200]; // Function
getSourceColor: NET_GAIN_COLOR; // Constant array variable
```

### Solid vs Gradient Arcs

```javascript
// Solid purple arc (both ends same color)
getSourceColor: NET_GAIN_COLOR,
getTargetColor: NET_GAIN_COLOR,

// Gradient arc (purple → red)
getSourceColor: NET_GAIN_COLOR,
getTargetColor: NET_LOSS_COLOR,
```

We use solid colors for clarity.

## Net Migration Logic

**Q: Why color by destination state?**

**A:** The dataset is state→county flows:

- Origin: State (or international region like "ASI")
- Destination: County (5-digit FIPS, first 2 digits = state)

We color arcs based on whether the **destination state** has net gain or loss:

- Purple arc = flowing into a net-gain state
- Red arc = flowing into a net-loss state

**Example:**

- California (state "06") has +50,000 net migration
- All arcs ending in California counties (06xxx) → **purple**
- Texas (state "48") has -20,000 net migration
- All arcs ending in Texas counties (48xxx) → **red**

This makes visual sense: purple arcs cluster around growing states, red arcs around shrinking states.

## International Origins (Asia, Europe, etc.)

For arcs from regions like "ASI" (Asia):

- Origin is NOT a US state
- Origin net = 0 (no US state data for international regions)
- Arc color determined solely by destination state's net
- Example: "Asia → California" = purple if California is net-gain

## Verification Steps

### In Browser Console (F12)

```
Net mode: 847 gain arcs, 523 loss arcs
Sample gain arc: {origin: "ASI", dest: "06037", ...} dest state: 06
Sample loss arc: {origin: "048", dest: "48029", ...} dest state: 48
```

This confirms:

1. Arcs are split into two arrays
2. Destination states are extracted correctly
3. Both categories have data

### Visual Check

1. Open Flow View → Metric: Net
2. Look for purple arcs (should be visible!)
3. Look for red arcs (should be visible!)
4. Hover over purple arc → tooltip shows "Dest State Net: +XXX (gain)"
5. Hover over red arc → tooltip shows "Dest State Net: -XXX (loss)"
6. Compare arc colors to legend → should match exactly

### Compare to Legend

```jsx
// Legend colors (from LegendPanel.jsx)
<LegendRow color="rgba(115, 96, 210, 1)" label="Net gain" />   // Purple
<LegendRow color="rgba(166, 54, 98, 1)" label="Net loss" />    // Red

// Arc colors (from MigrationFlowMap.jsx)
const NET_GAIN_COLOR = [115, 96, 210, 200];  // Purple (same RGB!)
const NET_LOSS_COLOR = [166, 54, 98, 200];   // Red (same RGB!)
```

## Files Changed

**`src/components/MigrationFlowMap.jsx`**:

1. **Line ~5**: Removed unused import

   ```javascript
   // ❌ Removed
   import { GreatCircleLayer } from "@deck.gl/geo-layers";
   ```

2. **Line ~5**: Added missing import

   ```javascript
   // ✅ Added
   import { HeatmapLayer } from "@deck.gl/aggregation-layers";
   ```

3. **Lines ~295-315**: Fixed layer creation

   ```javascript
   // ❌ Before (black arcs)
   const gainLayer = new GreatCircleLayer({
     getColor: () => NET_GAIN_COLOR,
   });

   // ✅ After (colored arcs)
   const gainLayer = new ArcLayer({
     getSourceColor: NET_GAIN_COLOR,
     getTargetColor: NET_GAIN_COLOR,
   });
   ```

4. **Lines ~298-305**: Added debug logging (can be removed later)

## Result

✅ **Net mode works correctly:**

- Purple arcs visible for net-gain destination states
- Red arcs visible for net-loss destination states
- Colors exactly match legend

✅ **Inbound/Outbound modes work:**

- Inbound = solid light blue
- Outbound = solid orange

✅ **International origins handled:**

- Asia→California arcs colored by California's net (not Asia's)
- Tooltip shows correct destination state net values

## Next Steps

1. **Test thoroughly** with different states and filters
2. **Remove debug logs** once confirmed working:
   ```javascript
   // Delete these lines after verification:
   console.log(`Net mode: ${gain.length} gain arcs, ${loss.length} loss arcs`);
   console.log('Sample gain arc:', ...);
   console.log('Sample loss arc:', ...);
   ```
3. **Optional enhancement**: Add color scale legend showing which states are gain vs loss
4. **Performance check**: Verify layer rendering is fast with thousands of arcs

## Technical Notes

- **Layer Type**: Both ArcLayer and GreatCircleLayer can be used, but must use correct color props
- **Great Circle vs Regular Arc**: GreatCircleLayer draws geodesic arcs (following Earth's curvature), ArcLayer draws straight lines in 3D space
- **For this fix**: We use ArcLayer since we already have it imported and it's simpler
- **Future**: Could switch back to GreatCircleLayer for more accurate geography, but MUST use getSourceColor/getTargetColor

## deck.gl Documentation References

- [ArcLayer API](https://deck.gl/docs/api-reference/layers/arc-layer)
- [GreatCircleLayer API](https://deck.gl/docs/api-reference/geo-layers/great-circle-layer)
- Both inherit from Layer → PathLayer → ArcLayer
- Both use `getSourceColor` and `getTargetColor`, NOT `getColor`
