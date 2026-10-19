# Field Shift — Farm Intelligence with NASA Data

A full-stack agricultural decision-support application built in React and Node.js that combines real NASA POWER daily climate observations with farmer-entered soil and farm context to screen explainable crop-rotation candidates.

> **Scientific boundary:** This is a decision-support prototype. Rotation scores are relative heuristics, not yield, profit, soil-health, or drought-resistance predictions. NASA POWER provides gridded meteorological estimates; this app does not measure field-level soil fertility or moisture. Validate crop calendars, local varieties, pests, markets, and soil-test results with a local agronomist.

## Features

- **React + TypeScript Dashboard**: Responsive layout with Overview, Farm Profile, Climate Signals, and Rotation Planner.
- **Persistent Light / AMOLED Black Theme**: Coordinated styling with a true `#000000` AMOLED-black canvas, mission-control accents, dark Leaflet map tiles, and local storage persistence.
- **Interactive Map Picker**: Leaflet and OpenStreetMap integration for visual farm point coordinate selection.
- **NASA POWER Daily Point API**: Direct server-side integration fetching `T2M`, `T2M_MAX`, `T2M_MIN`, and `PRECTOTCORR` with in-memory caching, missing-value sanitization, and monthly/annual summaries.
- **Transparent Rotation Screening**: Rule-based screening evaluating broad climate fit, relative water demands, soil pH matching, crop-family diversity, and budget constraints across farmer priorities (Balanced, Soil Health, Water Saving, Market Stability, Climate Resilience).
- **PDF Report Generation**: Exportable PDF summaries with farm profile metrics, climate evidence, and candidate rotation rationales.

## Architecture

The project has been rewritten as a unified React application powered by Vite and Node.js:

```text
/
├── index.html              # HTML entry point with metadata and AMOLED theme bootstrap
├── package.json            # Node.js dependencies and scripts
├── server.ts               # Express server hosting /api routes and Vite middleware (port 3000)
├── metadata.json           # Application metadata and capabilities
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration
└── src/
    ├── App.tsx             # Main application component and navigation
    ├── main.tsx            # React root with Error Boundary
    ├── api.ts              # Frontend client for API endpoints and client fallbacks
    ├── types.ts            # Type definitions for FarmProfile, ClimateData, Rotations
    ├── styles.css          # Base application stylesheet
    ├── theme.css           # Light and AMOLED black theme styles
    └── lib/
        ├── climate.ts      # NASA POWER Daily Point API integration and data summarization
        ├── rotation.ts     # Crop catalog, priority weights, and rotation screening engine
        └── report.ts       # Client- and server-side PDF report generation
```

## Running the Application

```bash
# Install dependencies
npm install

# Start the dev server (runs on port 3000)
npm run dev

# Build the production application
npm run build
```

## API Endpoints

- `GET /api/health` — Service health check.
- `GET /api/crops` — Catalog of starter crops and agronomic profiles.
- `GET /api/climate?latitude=...&longitude=...&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` — Normalized NASA POWER daily climate data, monthly aggregations, and annual precipitation records.
- `POST /api/recommendations` — Heuristic rotation ranking with component scores, reasons, and risks.
- `POST /api/report` — Generates a downloadable PDF report.

## TO USE THIS WEBSITE

run start-field-shift.bat 
