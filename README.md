# Field Shift — Adapting Farms with NASA Data

A full-stack agricultural decision-support MVP that combines real NASA POWER daily climate responses with farmer-entered soil and farm context to compare explainable crop-rotation screening options.

> **Scientific boundary:** This is a decision-support prototype. Rotation scores are relative heuristics, not yield, profit, soil-health, or drought-resistance predictions. NASA POWER provides gridded meteorological data; this app does not measure field-level soil fertility or moisture. Validate crop calendars, local varieties, pests, markets, and soil-test results with a local agronomist.

## Features

- React + TypeScript dashboard designed for desktop and mobile.
- Persistent light/AMOLED-black mode with a coordinated dark map basemap, visible theme controls, and saved preference.
- Interactive Leaflet/OpenStreetMap point selection.
- Python FastAPI backend and validated request models.
- Live NASA POWER Daily Point API client with short-lived in-memory caching, timeout/error handling, and missing-value normalization.
- Climate summaries and charts derived from the API response, including mean temperature, mean daily high/low, precipitation sums, monthly patterns, annual grouping, and data coverage.
- Explainable rotation shortlist with configurable farmer-priority weights, current-crop continuity check, farmer-prioritized crop bonus, crop profile facts, risks, confidence flags, and data gaps.
- PDF farm assessment report.
- Backend tests for score ranking, data-gap handling, and NASA response normalization.

## Data source

The backend uses the [NASA POWER daily point endpoint](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) with the Agroclimatology (`AG`) community and parameters `T2M`, `T2M_MAX`, `T2M_MIN`, and `PRECTOTCORR`. The app requests UTC time standard.

- Temperatures are presented in °C.
- `PRECTOTCORR` is presented as precipitation in mm/day; monthly/period totals sum valid daily values.
- The app requests and displays the data period, coordinates, parameter names, source URL, retrieval timestamp and completeness indicators.
- NASA POWER parameters have source-specific spatial resolution, and a coordinate is not a field-level sensor reading. Consult the official parameter dictionary and API docs when extending this app.
- The crop profiles shipped here are a regional starter knowledge base and broad screening heuristics, not locally validated agronomic prescriptions.

## Quick start (Windows)

1. Install Node.js 20+ and Python 3.11+ if not already installed.
2. Extract the entire ZIP to a normal writable folder (do not run it from inside the ZIP preview).
3. Double-click `start-field-shift.bat` at the project root. It creates the Python environment, installs dependencies, opens separate backend/frontend terminal windows, and opens the frontend in your browser. Keep both server windows open.
4. If the launcher fails, double-click `diagnose-field-shift.bat`. It writes `field-shift-diagnostics.txt` in the project root; share that file or the exact terminal error for troubleshooting.

The first launch needs internet access to install Python and npm dependencies. Live climate loading also needs internet access to `power.larc.nasa.gov`. If the app loads but climate fetch fails, check `http://127.0.0.1:8000/api/health` first and then retry the NASA climate request from the app.

### If the frontend is blank

Use the latest project ZIP and extract it to a new folder. This release fixes a missing `Leaf` icon import that could throw during the overview render, adds the missing `community` field to the climate TypeScript type, and wraps the React app in an error boundary. If any render-time exception remains, the page should now show a readable error panel instead of a blank screen. Keep the terminal running `npm run dev` open and check that it reports no Vite compile errors.

## Local development (Windows / Antigravity)

### 1. Prerequisites

- Node.js 20+ and npm.
- Python 3.11+ recommended.
- An internet connection for NASA POWER responses and OpenStreetMap tiles.

### 2. Start the backend

Open a terminal at the project root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend health check: http://127.0.0.1:8000/api/health  
Interactive API docs: http://127.0.0.1:8000/docs

If PowerShell blocks activation, either use `Set-ExecutionPolicy -Scope Process Bypass` for that terminal or create the environment with `py -m venv .venv` and invoke `.venv\Scripts\python.exe -m pip ...` directly.

### 3. Start the frontend

Open a second terminal at the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL Vite prints, normally http://localhost:5173. The Vite development server proxies `/api` requests to `http://127.0.0.1:8000`.

### 4. Test the backend

From the `backend` folder with the virtual environment activated:

```powershell
pytest -q
```

A small live API smoke test can be requested from the backend (from any terminal with `curl.exe`):

```powershell
curl.exe "http://127.0.0.1:8000/api/climate?latitude=19.076&longitude=72.8777&start_date=2025-01-01&end_date=2025-01-31"
```

The climate endpoint deliberately returns a 502 with a readable detail if NASA POWER is unreachable or returns unusable data; it does not invent fallback climate values.

## Main API routes

- `GET /api/health` — process health check.
- `GET /api/crops` — current crop knowledge base.
- `GET /api/climate?latitude=...&longitude=...&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` — normalized NASA POWER climate data, summary and monthly series.
- `POST /api/recommendations` — ranked rotation candidates with weights, rationale, risks and data gaps.
- `POST /api/report` — PDF report for a farm profile and current data.

## Deployment notes

- Deploy the frontend and backend separately, set `VITE_API_BASE_URL` to the deployed API origin at frontend build time, and configure backend CORS to allow the deployed frontend origin before exposing the service publicly.
- The current CORS list is restricted to local Vite origins. Update it deliberately for production rather than using a wildcard by default.
- The built-in cache is process-local; it resets on restart and is not shared across multiple backend workers. Use a shared cache if deploying at scale.
- Add persistent storage, accounts, privacy controls and audited regional crop-data sources before storing real farmer records or using the service for consequential farm planning.
- GPM IMERG and MODIS are intentionally listed as future integrations, not claimed as implemented in this version.

## Repository layout

```text
field-shift/
  backend/
    app/
      climate.py       # NASA POWER client + daily/monthly normalization
      main.py          # FastAPI routes + PDF export
      models.py        # Request validation
      rotation.py      # Crop database + scoring heuristics
    tests/
  frontend/
    src/
      App.tsx          # Dashboard, farm setup, climate charts, planner
      api.ts           # Frontend/backend API client
      types.ts         # Domain types
      styles.css       # Responsive UI
    package.json
  README.md
```
## Interface theme

The interface includes a persistent Light/AMOLED Black mode toggle in the top bar and sidebar. AMOLED Black uses a true #000000 canvas with near-black panels, subtle mission-control grid lines, telemetry cyan, and field-green status accents. It remembers the selected theme in browser local storage and defaults to AMOLED Black for a fresh session, and switches the farm map to a dark basemap in dark mode. The theme is entirely client-side and does not affect NASA data requests or recommendation calculations.

### Theme mode

Field Shift opens in **AMOLED Black** by default. Use the **AMOLED ON** button in the top-right header or the **AMOLED BLACK** switch in the sidebar to toggle the appearance; the selection is saved in browser storage. In light mode the header button reads **AMOLED BLACK** to enable it.

## Mission-control UI update

The overview now uses the supplied AMOLED-black NASA mission-control reference more consistently, with restrained cyan telemetry accents, lime farm indicators, subtle grid/radial lighting, animated page entry, hover feedback, pulsing service indicators, and a reduced-motion accessibility fallback. The overview also includes a clearly labelled roadmap for planned features: live satellite imagery, climate-risk alerts and rainfall anomalies, more regionally validated rotation recommendations, historical-versus-recent climate comparisons, and public deployment. These roadmap cards are marked **PLANNED** and are not represented as implemented features.

The UI animations use CSS and React state, so no additional animation package is required.
