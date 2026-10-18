# Field Shift project guidance

- Treat NASA POWER API responses as source data. Never insert invented climate values as a fallback.
- Keep data provenance, missing-data coverage, assumptions, and known limitations visible in UI and reports.
- The starter crop profiles and weighted ranking are screening heuristics only. Do not describe scores as yield, profit, or measured soil-health predictions.
- If changing the API, keep request validation and error handling in FastAPI. Never expose third-party secrets in the frontend.
- For backend changes, run `cd backend && pytest -q`.
- For frontend changes, run `cd frontend && npm run build` after `npm install`.
- Verify any changed NASA POWER parameter against the official parameter dictionary and daily API documentation.
- Keep local development straightforward for Windows users working in Google Antigravity.
