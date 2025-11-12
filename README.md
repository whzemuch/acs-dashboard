# ACS Migration Dashboard

> An interactive visualization platform for exploring U.S. county-to-county migration patterns using American Community Survey data with machine learning predictions (xgboost) and SHAP explainability.

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://whzemuch.github.io/acs-dashboard/)
[![React](https://img.shields.io/badge/React-19.1-blue)](https://reactjs.org/)
[![DeckGL](https://img.shields.io/badge/deck.gl-9.0-orange)](https://deck.gl/)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple)](https://vitejs.dev/)

**[🚀 Live Demo](https://whzemuch.github.io/acs-dashboard/)** | **[📖 User Guide](user_guide.md)**

---

## Overview

The ACS Migration Dashboard is a comprehensive data visualization tool designed for researchers, policymakers, urban planners, and data scientists to explore and understand U.S. migration patterns at the county level. Built on American Community Survey (ACS) data, it combines:

- **Real migration data** from ACS 5-year estimates (2023)
- **Machine learning predictions (xgboost)** trained on demographic and socioeconomic features
- **SHAP explainability** to understand what drives migration decisions
- **Interactive visualizations** with three complementary views (Choropleth, Flow, Comparison)

### Key Capabilities

- Visualize state-to-county migration flows with interactive arc diagrams
- Explore net migration gains/losses through color-coded choropleth maps
- Compare migration patterns between two locations side-by-side
- Understand feature importance with SHAP contribution analysis
- Toggle between observed and predicted data to validate model accuracy
- Filter by demographic factors, migration thresholds, and geographic regions

---

## Prerequisites

- **Node.js** 18+ and npm
- **Mapbox account** (free tier) for base map tiles - [Sign up here](https://account.mapbox.com/auth/signup/)

---

## Quick Start

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/whzemuch/acs-dashboard.git
   cd acs-dashboard
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Mapbox token**

   Create a `.env.local` file in the root directory:

   ```env
   VITE_MAPBOX_TOKEN=your_mapbox_access_token_here
   ```

   Get your token from [Mapbox Account](https://account.mapbox.com/access-tokens/)

4. **Start development server**

   ```bash
   npm run dev
   ```

   Open http://localhost:5173 in your browser

### Building for Production

```bash
npm run build
npm run preview
```

The optimized production build will be in the `dist/` directory.

---

## Features

### 🗺️ Interactive Migration Flows

- **Deck.gl ArcLayer** renders migration flows as curved arcs between counties
- **Sign-aware coloring**: Blue for inbound, orange for outbound migrations
- **Rich tooltips**: Hover to see origin, destination, flow counts, and demographics
- **Dynamic filtering**: Adjust minimum flow threshold to focus on significant migrations

### 📊 Three Complementary Views

1. **Choropleth View** - Color-coded county maps showing net migration intensity
2. **Flow View** - Arc-based visualization of top migration corridors
3. **Comparison View** - Side-by-side analysis with independent controls

### 🧠 SHAP Explainability

- Understand **why** people migrate between specific locations
- See which features (age, income, housing costs, education, etc.) drive each flow
- Sort by absolute value or contribution direction
- Export SHAP data as CSV for further analysis

### 🎯 Advanced Filtering

- **Geographic**: Drill down from national → state → county level
- **Direction**: Toggle between inbound/outbound migrations
- **Data type**: Switch between observed ACS data and ML predictions
- **Top destinations**: Auto-highlight the 10 largest flows
- **Feature filter**: Isolate flows influenced by specific factors (e.g., poverty, education)

### ⚡ Performance Optimizations

- Precomputed data caches eliminate runtime CSV parsing
- Web Workers handle heavy computations off the main thread
- Memoized selectors prevent unnecessary re-renders
- Simplified geometries (5m resolution) for smooth map interactions
- Lazy loading and code splitting for faster initial load

---

## Deployment: GitHub Pages

```bash
npm run deploy
```

This builds the app and pushes `dist/` to the `gh-pages` branch.

---

**Contributed by**: CSE6242 2025Spring Team095
