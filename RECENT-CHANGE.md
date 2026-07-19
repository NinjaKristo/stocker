# RECENT CHANGE

`codex resume -C "C:\Users\micro\github\FINANCE\stock-screener" 019f66bb-57c3-7483-8cf9-c35c63143e8c`

> Delayed five-minute chart mode
>
> Completed: 2026-07-19
>
> Branch: `feat/delayed-intraday-charts`
>
> Bead: `stockscreenclaude-m4l`

---

## Problem

The repaired daily charts show the latest completed trading day, but they cannot show
what happened during the session. Reloading a daily chart only rereads daily cache and
does not create intraday bars. The application needed a faster view without claiming
free delayed data was exchange-grade real-time data.

---

## Actions, Problems Solved, And Test Method

| Action | Problem solved | Method used | Passing evidence |
|---|---|---|---|
| Added `GET /v1/stocks/{symbol}/intraday?interval=5m` | Daily cache endpoints cannot represent intraday timestamps or provenance | Added a separate typed response with timestamped OHLCV bars, provider, latest-bar time, fetch time, cache status, and `is_realtime` | Endpoint contract and error tests passed |
| Kept intraday data outside PostgreSQL daily bars | Mixing five-minute and daily rows would corrupt the durable daily price contract | Created a dedicated read-through service that never calls daily cache persistence | Service tests assert the provider path and isolated payload |
| Added a 60-second Redis response cache | Repeated chart clicks could waste provider capacity and trigger throttling | Cache key is scoped by version, symbol, and interval; cache failure degrades to a rate-limited live request | Cache-hit test proves the second request avoids the provider |
| Reused the distributed Yahoo rate limiter | Concurrent users could exceed a free public provider's practical request capacity | The service calls the existing `YFinanceService` with its Redis-backed limiter | Live AAPL request succeeded; fallback remains available if Redis is down |
| Offloaded the provider call from FastAPI's event loop | A synchronous network request inside an async route could pause unrelated API requests | Route executes the service through Starlette's worker-thread helper | Focused endpoint suite passed after the change |
| Normalized provider frames into timezone-aware bars | Intraday data needs timestamps, not date-only strings, and exchanges use different time zones | Validated OHLCV columns, rejected non-finite prices, preserved provider offsets, sorted by absolute time, and normalized volume | Timezone, malformed-frame, and unavailable-provider tests passed |
| Added `5 min delayed` to the shared chart | Users had no way to select a newer intraday view | Added a third interactive timeframe backed by React Query with a 60-second stale time | Component interaction test clicks the selector and verifies the endpoint call |
| Disabled RS in intraday mode | The RS series is daily and would be misleading beside five-minute candles | Intraday selection clears old series, disables RS, and fits the new time axis | Component test verifies RS is disabled and the chart receives numeric UTC timestamps |
| Displayed source and actual latest-bar time | A fresh HTTP response could still contain an older provider bar | Label reads `Delayed 5 min`, provider name, `bar <time>`, and separate `loaded <time>` | Component and formatting tests passed |

---

## Live Result

A live provider request for AAPL on Sunday, July 19 returned:

```text
source=Yahoo Finance via yfinance
is_realtime=False
bars=390
latest_bar_at=2026-07-17T15:55:00-04:00
```

That is the correct honest result for a closed weekend market: five trading days of
five-minute bars, ending at Friday's final available interval rather than pretending a
Sunday stream exists.

---

## Verification

### Passed for this change

```text
Focused backend and related price endpoints:  16 passed
Focused frontend API/chart tests:              6 passed
Frontend lint:                                 passed, 0 errors
Frontend production build:                     passed
Backend compile check:                         passed
Live public-provider request:                  passed, 390 AAPL bars
```

### Repository-wide baseline failures

The wide gates were also run. Their failures are outside this change:

| Gate | Result | Existing problem |
|---|---|---|
| Full frontend suite | 30 failures | `ResultsTable` tests render `TickerLink` without Router context; tracked as `stockscreenclaude-ob3` |
| Full backend unit suite | 4,713 passed, 6 skipped, 11 failed | Eight stale expectations still assert removed Minimax/Z.AI models after local Groq-routing commits; three FX stale-date tests misclassify Saturday as stale when run on Sunday |

The weekend FX defect is tracked as `stockscreenclaude-dla`. The Groq expectation files
already have uncommitted corrections in the main working tree and were not copied into
this isolated feature branch.

---

## Files Changed

```text
backend/app/api/v1/stocks.py
backend/app/schemas/stock.py
backend/app/services/intraday_price_service.py
backend/tests/unit/test_intraday_price_service.py
backend/tests/unit/test_stocks_intraday.py
frontend/src/api/priceHistory.js
frontend/src/api/priceHistory.test.js
frontend/src/components/Charts/CandlestickChart.jsx
frontend/src/components/Charts/CandlestickChart.test.jsx
frontend/src/components/Charts/candlestickData.js
frontend/src/components/Charts/candlestickData.test.js
```

---

## Result

Interactive charts now offer an honest, source-labeled five-minute delayed mode while
retaining durable daily and weekly views. The application still does not claim or
provide exchange-grade real-time streaming data.
