# User Guide: ACS Migration Dashboard

## Overview

The ACS Migration Dashboard is an interactive visualization tool for exploring U.S. county-to-county migration patterns. It combines observed American Community Survey (ACS) data with machine learning predictions to help you understand migration flows and the factors driving them.

---

## Getting Started

### Main Views

The dashboard offers three interactive views:

1. **Choropleth View** - Color-coded county maps showing migration patterns
2. **Flow View** - Arc-based visualization of migration flows between counties
3. **Comparison View** - Side-by-side analysis of two different locations or scenarios

Switch between views using the buttons at the top of the interface.

### Basic Navigation

- **Select a State**: Use the State dropdown to focus on a specific state
- **Select a County**: Use the County dropdown to drill down to county-level data
- **Toggle Flow Direction**: Choose between Inbound (migration to) or Outbound (migration from)
- **Adjust Flow Visibility**: Use the "Min Flow" slider to filter out smaller migration streams
- **View Top Destinations**: Check "Top 10" to highlight the largest migration flows

---

## Key Features

### 1. Interactive Maps

- **Hover** over counties or migration arcs to see detailed information
- **Click** on counties in Choropleth view to see detailed statistics
- **Click** on migration arcs in Flow view to explore SHAP feature contributions

### 2. SHAP Contributions

- Shows which demographic and socioeconomic factors most influence each migration flow
- Features include: Geographic proximity, Age, Language, Poverty, Housing costs, Education, and more
- Toggle "Sort by absolute value" to see features ranked by importance

### 3. Observed vs. Predicted Data

- **Observed**: Real migration counts from ACS data
- **Predicted**: Machine learning model predictions
- Toggle between them to validate model accuracy or explore predicted patterns

### 4. Feature Filtering

- Use the "Feature Filter" dropdown to highlight specific influential factors
- See which migration flows are most affected by factors like poverty, education, or housing costs

---

## Use Cases: Questions You Can Answer

### Use Case 1: Understanding Regional Migration Hotspots

**Question**: _"Which counties are experiencing the highest net migration gains or losses?"_

**How to explore**:

1. Go to **Choropleth View**
2. Select "All Counties" to see the entire U.S.
3. Observe the color intensity - darker colors indicate higher net migration
4. Toggle between **Inbound** and **Outbound** to see which counties are gaining vs. losing population
5. Hover over counties to see exact migration numbers

**Insight**: Identify growth regions (popular destinations) and declining areas (high outmigration), useful for economic development planning and resource allocation.

---

### Use Case 2: Analyzing Migration Corridors Between States

**Question**: _"Where do people who leave California tend to move?"_

**How to explore**:

1. Go to **Flow View**
2. Select **State**: California
3. Select **County**: All Counties
4. Choose **Outbound** direction
5. Check the **Top 10** checkbox to highlight major destinations
6. Adjust the **Min Flow** slider to focus on significant migrations

**Insight**: Visualize the top destination states and counties for California emigrants, revealing migration corridors like California → Texas, California → Arizona, etc.

---

### Use Case 3: Identifying Drivers of Specific Migration Patterns

**Question**: _"Why do so many people move from New York City to Florida counties?"_

**How to explore**:

1. Go to **Flow View**
2. Select **State**: New York
3. Select **County**: New York County (Manhattan)
4. Choose **Outbound** direction
5. **Click on a migration arc** pointing to a Florida county
6. Review the **SHAP Contributions** panel that appears
7. Look at the top features with highest absolute SHAP values

**Insight**: Discover that factors like lower housing costs, warmer climate (geographic proximity variations), retirement demographics (age), or tax differences drive this migration pattern.

---

### Use Case 4: Comparing Migration Patterns Between Two Locations

**Question**: _"How do migration patterns differ between Austin, Texas and Seattle, Washington?"_

**How to explore**:

1. Go to **Comparison View**
2. On the **left side**: Select State: Texas, County: Travis County (Austin)
3. On the **right side**: Select State: Washington, County: King County (Seattle)
4. Choose **Inbound** to see where migrants come from
5. Compare the **Top 10 Destination Counties** panels
6. Toggle to **Flow** comparison type to see visual arc patterns
7. Review summary statistics at the bottom

**Insight**: Compare tech hub migration patterns - see if Austin attracts more from California while Seattle draws from different regions, and understand demographic differences in who moves where.

---

### Use Case 5: Evaluating Model Performance and Data Quality

**Question**: _"How accurate are the migration predictions, and which flows are hardest to predict?"_

**How to explore**:

1. Go to **Choropleth View** or **Flow View**
2. Select a state or county of interest
3. Toggle between **Observed** and **Predicted** using the Value toggle
4. Compare the numbers in the **Summary panel**:
   - Inbound (Obs) vs. Inbound (Pred)
   - Outbound (Obs) vs. Outbound (Pred)
5. In **Flow View**, click on different migration arcs and check SHAP contributions
6. Look for arcs where Observed and Predicted values diverge significantly

**Insight**: Assess where the ML model performs well (predictions close to observed) and where it struggles, helping identify unusual migration patterns or areas needing model improvement.

---

## Tips for Effective Use

### General Tips

- **Use separate Min Flow sliders** for each location in Comparison view to handle different migration scales
- **Toggle between Flow arcs and Choropleth** colored counties to see patterns from different perspectives
- **Start broad (state level)** then drill down to specific counties for detailed analysis
- **Check "Top 10"** to focus on the most significant migration flows

### Understanding SHAP Values

- **Positive SHAP values** (green): Feature increases migration likelihood
- **Negative SHAP values** (orange): Feature decreases migration likelihood
- **Larger absolute values**: Stronger influence on the prediction
- **Geographic Categorical**: Captures regional affinities and unmeasured location factors

### Troubleshooting

- **Missing Mapbox Token**: Ensure `VITE_MAPBOX_TOKEN` is set in `.env.local`
- **Data Not Loading**: Check if cache files are generated in `public/data/cache`
- **Slow Performance**: Verify browser compatibility and clear cache

---

## Glossary

- **Inbound**: Migration flows coming into the selected location
- **Outbound**: Migration flows leaving the selected location

- **SHAP**: A method for explaining individual predictions by computing feature importance
- **Observed**: Actual migration counts from ACS survey data
- **Predicted**: Migration estimates from the machine learning model
