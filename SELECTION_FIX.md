# Arc Selection Highlighting Fix

## Problem

1. When nothing was selected, arcs were being faded (incorrect behavior)
2. No red arcs appearing in Net view (need to debug state net calculations)

## Solution

### Selection Highlighting Logic

**Before (Incorrect):**

```javascript
// Always applied dimming based on selection
const alpha =
  selectedArc && d.id !== selectedArc.id
    ? arcColor[3] * dimFactor // Dimmed
    : arcColor[3]; // Full
```

**After (Correct):**

```javascript
// Three states: no selection, selected, non-selected
if (!selectedArc) {
  // No selection - show original color at full opacity
  return arcColor;
}
if (d.id === selectedArc.id) {
  // This IS the selected arc - keep full color
  return arcColor;
}
// This is NOT the selected arc - fade to grey
const alpha = arcColor[3] * dimFactor;
return [128, 128, 128, alpha]; // Grey with reduced opacity
```

### Behavior

**When NO arc is selected:**

- All arcs show their original colors at full opacity
- Net gain: Purple
- Net loss: Red
- Inbound: Light blue
- Outbound: Orange

**When ONE arc is selected:**

- Selected arc: Keeps its original color + white overlay for emphasis
- All other arcs: Faded to grey (RGB: 128, 128, 128) at 20% opacity
- Easy to trace the selected flow from origin to destination

## Debug Logging for Net View Issue

Added comprehensive logging to investigate why no red arcs appear:

```javascript
console.log(`Net mode: ${gain.length} gain arcs, ${loss.length} loss arcs`);
console.log(
  "Available state codes in inState:",
  Object.keys(inState || {}).slice(0, 10)
);
console.log(
  "Available state codes in outState:",
  Object.keys(outState || {}).slice(0, 10)
);

// Sample arc details
if (gain.length > 0) {
  const g = gain[0];
  const destState = g.dest.slice(0, 2);
  console.log(
    "Sample gain arc:",
    g,
    "dest state:",
    destState,
    "inbound:",
    inState?.[destState],
    "outbound:",
    outState?.[destState],
    "net:",
    (inState?.[destState] ?? 0) - (outState?.[destState] ?? 0)
  );
}

// Sample multiple arcs to see pattern
const sampleArcs = arcs.slice(0, 5);
console.log("Sample arc destination states and net:");
sampleArcs.forEach((a) => {
  const ds = a.dest.slice(0, 2);
  const netVal = (inState?.[ds] ?? 0) - (outState?.[ds] ?? 0);
  console.log(
    `  Arc to ${ds}: in=${inState?.[ds]}, out=${outState?.[ds]}, net=${netVal}`
  );
});
```

## Debugging Steps

### Check Browser Console

Open browser console (F12) and look for:

1. **Arc counts**:

   ```
   Net mode: X gain arcs, Y loss arcs
   ```

   - If `loss arcs = 0`, there's a data issue

2. **State code format**:

   ```
   Available state codes in inState: ["06", "48", "36", ...]
   ```

   - Should be 2-digit strings like "06", "48", "36"

3. **Net calculations**:
   ```
   Arc to 06: in=50000, out=30000, net=20000  (gain - correct)
   Arc to 48: in=25000, out=40000, net=-15000 (loss - should be red)
   ```

### Possible Issues

**Issue 1: All states have positive net**

- Unlikely in real migration data
- Check if data is filtered (e.g., only showing certain demographics that all have positive net)

**Issue 2: State code mismatch**

- County FIPS might be 3 digits (e.g., "048") instead of 5 digits (e.g., "48029")
- Check: `a.dest.slice(0, 2)` should extract state code correctly

**Issue 3: Summary data not loaded**

- `inState` or `outState` might be empty objects
- Check if `summaryData` is properly loaded from `getSummary()`

**Issue 4: Wrong value type selected**

- Check if observed vs predicted data has different patterns
- Try toggling between "Observed" and "Predicted" values

### Quick Test

In browser console, run:

```javascript
// Access the store
const store = window.__ZUSTAND_DEVTOOLS_STORE__ || {};

// Check summary data
console.log("Summary data:", summaryData);
console.log("Inbound by state:", summaryData?.inboundTotalsByStateObserved);
console.log("Outbound by state:", summaryData?.outboundTotalsByStateObserved);

// Calculate net for each state
Object.keys(summaryData?.inboundTotalsByStateObserved || {}).forEach(
  (state) => {
    const inb = summaryData.inboundTotalsByStateObserved[state];
    const out = summaryData.outboundTotalsByStateObserved[state];
    const net = inb - out;
    if (net < 0) {
      console.log(`State ${state}: net = ${net} (LOSS)`);
    }
  }
);
```

## Expected Behavior After Fix

### Selection States

1. **No Selection (Default)**

   - Map shows all arcs in their category colors
   - Purple arcs: States with net gain
   - Red arcs: States with net loss
   - All at full opacity

2. **One Arc Selected**

   - Selected arc: Full color + white overlay (6px width)
   - All other arcs: Grey [128, 128, 128] at 20% opacity
   - Easy to identify the selected flow path

3. **Click Background**
   - Deselects arc
   - Returns to state 1 (all arcs full color)

### Visual Clarity

- **Grey fading** is more neutral than color-based fading
- Selected arc "pops" against grey background
- White overlay makes selected arc even more visible
- No confusion about whether faded arcs are gain or loss

## Files Modified

- `src/components/MigrationFlowMap.jsx`:
  - Fixed selection highlighting logic for net mode (gain/loss layers)
  - Fixed selection highlighting logic for inbound/outbound mode
  - Added comprehensive debug logging
  - Changed non-selected arc color to grey instead of dimmed original color

## Next Steps

1. Run the app and check browser console for debug output
2. Identify why `loss.length = 0` (if that's the case)
3. Verify state codes are being extracted correctly
4. Check if summary data has both inbound and outbound totals
5. Once red arcs appear, remove debug logging

## Testing Checklist

- [ ] Open Flow View → Metric: Net
- [ ] Check console: Do we see "X gain arcs, Y loss arcs" with Y > 0?
- [ ] Check console: Are state codes 2-digit strings?
- [ ] Check console: Do any states have negative net values?
- [ ] Visual: Are there red arcs on the map?
- [ ] Click an arc: Does it keep its color while others turn grey?
- [ ] Click background: Do all arcs return to original colors?
- [ ] Switch to Inbound: Same selection behavior?
- [ ] Switch to Outbound: Same selection behavior?
