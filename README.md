# ACS Dashboard

An interactive web-based dashboard for visualizing American Community Survey (ACS) data at the PUMA (Public Use Microdata Area) level.  
Built with **React, Deck.gl, Mapbox, D3.js, and Vite**, this project allows users to explore geographic education data and related metrics.

---

## Features

Live Demo: **[View the deployed site](https://whzemuch.github.io/acs-dashboard/)**

- Interactive **map of PUMA regions** using Deck.gl + Mapbox
- **Hover tooltips & popups** with education stats visualized by D3.js
- **Responsive layout** using React components

---

## Getting Started

### 1. Clone this repo

```bash
git clone https://github.com/whzemuch/acs-dashboard.git
cd acs-dashboard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run locally (development mode)

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### 4. Preview the Production Build

```bash
npm run build
npx vite preview --base=/acs-dashboard/
```

Then open the printed local URL like
http://localhost:4173/acs-dashboard/.

### Example Pseudo Data

For the demo purpose, I just used this minimal example:

public/data/education_by_puma_2023.json

```json
[
  {
    "PUMA": 101,
    "city": "Los Angeles",
    "ba_or_higher": 0.42,
    "coefficients": { "hs": 1.0, "ba": 1.5, "grad": 2.1 }
  },
  {
    "PUMA": 202,
    "city": "San Antonio",
    "ba_or_higher": 0.35,
    "coefficients": { "hs": 1.0, "ba": 1.4, "grad": 1.9 }
  },
  {
    "PUMA": 303,
    "city": "New York",
    "ba_or_higher": 0.58,
    "coefficients": { "hs": 1.0, "ba": 1.7, "grad": 2.3 }
  }
]
```

public/data/geo/puma_shapes.json (simplified shapes)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "PUMA": 101, "name": "Los Angeles" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-118.5, 34.0],
            [-118.1, 34.0],
            [-118.1, 34.2],
            [-118.5, 34.2],
            [-118.5, 34.0]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": { "PUMA": 202, "name": "San Antonio" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-98.6, 29.3],
            [-98.3, 29.3],
            [-98.3, 29.6],
            [-98.6, 29.6],
            [-98.6, 29.3]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": { "PUMA": 303, "name": "New York" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.1, 40.6]
          ]
        ]
      }
    }
  ]
}
```
