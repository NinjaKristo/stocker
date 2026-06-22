# Static Launch Design

## Goal

Get the cloned stock screener running locally without requiring paid APIs, a database, Redis, Celery, or brokerage integrations for the first phase.

## Approach

Use the existing React static-site mode as the default local launcher path. The frontend will load read-only scanner data from a configurable static-data base URL, defaulting in the launcher to the public GitHub Pages data bundle at `https://xang1234.github.io/stock-screener/static-data/`.

## User-Facing Scope

- `CJN-LAUNCH.bat` starts the local frontend in static mode.
- The app keeps the existing dark, compact, scanner-table look: dense rows, blue app bar, market selector, scan tabs, small typography, and read-only status chip.
- No paid API keys are required for this startup path.
- Backtesting and live trading persistence are deferred to later phases.

## Data Flow

`CJN-LAUNCH.bat` sets `VITE_STATIC_SITE=true` and `VITE_STATIC_DATA_BASE_URL=https://xang1234.github.io/stock-screener/static-data/`, then runs Vite. `getStaticDataUrl()` resolves all static JSON requests against that base URL. If the env var is not set, the existing local `/static-data/` behavior remains unchanged for builds that ship their own bundle.

## Error Handling

Fetch failures stay in the existing static query error surfaces. The launcher prints a clear message that it is using public read-only data and points the user at the local Vite URL.

## Testing

- Add a unit test for `getStaticDataUrl()` with `VITE_STATIC_DATA_BASE_URL`.
- Run the targeted static tests.
- Build the frontend in static mode.
- Start the launcher path and verify the local page serves from Vite.
