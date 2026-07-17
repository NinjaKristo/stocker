# RECENT CHANGE

> Daily chart freshness repair  
> Completed: 2026-07-17  
> Branch: `stocker/fix/daily-chart-freshness`  
> Commit: `09a3da6b`

---

## Problem

Charts were showing prices from 10 to 11 days earlier. Reloading the browser did not
make them current because the chart endpoints read cached daily bars; a page refresh
does not download new market data.

The scheduled data task was running, but its Celery worker used the prefork pool while
the Yahoo client used one process-wide `curl_cffi` session. The mismatch caused the
worker to crash with `SIGSEGV` after pandas-related errors such as:

```text
'tuple_iterator' object is not callable
'Timestamp' object is not iterable
```

Before repair, 7,534 of 10,084 tracked symbols ended on July 6, 2026. Only SPY had a
July 16 bar.

---

## Actions, Problems Solved, And Test Method

| Action | Problem solved | Method used | Passing evidence |
|---|---|---|---|
| Changed only `celery-datafetch` to `--pool=solo --concurrency=1` | Prefork workers were sharing a process-global Yahoo session unsafely and crashing before data could be saved | Added a worker-command contract test, rebuilt the service, and inspected the live Celery startup configuration | Contract test passed; live worker reported solo pool/concurrency 1; refresh completed without `SIGSEGV` |
| Added canonical Yahoo-frame normalization | yfinance can return flat or MultiIndex frames, with the ticker on either column level; downstream code could misread those shapes | Added fixtures for single-symbol flat data and both MultiIndex orientations | Focused ingestion tests passed for all supported shapes |
| Standardized Date, OHLCV, numeric values, ordering, and duplicate handling | Invalid or inconsistent rows could enter the cache/persistence path | Validated required columns and dates before returning a canonical frame | Invalid/noncanonical-frame rejection test passed |
| Persisted PostgreSQL rows before publishing Redis data | Redis could show data that was never durably committed, and database failures could be counted as successful refreshes | Forced a database failure in a unit test and asserted rollback, exception propagation, and no Redis publish | Database-failure/no-publication test passed |
| Switched row conversion from `iterrows` to `itertuples` | The crashing worker had failed inside pandas iterator behavior during persistence | Added a single-row database-persistence regression test using the canonical frame path | Single-row persistence test passed |
| Added `Data through <market date>` to the shared candlestick component | Users could not distinguish stale market data from a freshly reloaded page | Extracted latest-bar selection and formatting into tested frontend utilities | 2 frontend unit tests passed; five live charts showed `Data through Jul 16, 2026` |
| Kept market-data date separate from response fetch time | Browser refresh made the page look refreshed even though its underlying bars were unchanged | Rendered the newest candle date independently of cache/load metadata | Visual acceptance confirmed the market date remained explicit after reload |
| Added `frontend/.dockerignore` | A Linux Docker build copied Windows `node_modules`, then failed because it tried to run `node.exe` | Excluded host dependency/build folders and rebuilt the frontend image | Second Docker build passed |

---

## Test Execution

### Passed for this change

```text
Backend worker + Yahoo ingestion tests:       48 passed, 3 skipped
Additional refresh/calendar/bundle tests:     60 passed
Focused backend total:                       108 passed, 3 skipped
Frontend chart-date tests:                     2 passed
Frontend lint:                                 passed, 0 errors
Frontend production build:                     passed
Frontend Docker build:                         passed
Live scheduled refresh:                        completed in 153.17 seconds
```

The live refresh used the existing database and environment. It returned `partial`
with source `github+live`: 27 symbols were refreshed from the live provider after the
daily bundle sync, while 124 upstream-provider rejections were retained as failures
instead of being hidden.

### Live chart acceptance

The application was checked with local Playwright and Chrome against the repaired UI.
Each representative chart rendered canvas content and displayed the correct label:

| Ticker | Latest verified daily bar |
|---|---|
| SPY | 2026-07-16 |
| AAPL | 2026-07-16 |
| MSFT | 2026-07-16 |
| NVDA | 2026-07-16 |
| AMZN | 2026-07-16 |

---

## Repository-Wide Baseline Failures

These failures were found while widening verification. They are not caused by the
daily-chart repair, and each has a follow-up issue rather than being omitted from the
report.

| Gate | Existing problem | Tracking issue |
|---|---|---|
| Full frontend suite | 30 ResultsTable failures because tests render `TickerLink` without Router context | `stockscreenclaude-ob3` |
| Full backend root collection | An integration test performs an unauthenticated request to hardcoded `localhost:8000` during collection | `stockscreenclaude-03c` |
| Full backend unit suite | 4,716 passed, 6 skipped, and 1 unrelated theme model-selection failure caused by runtime registry fallback | `stockscreenclaude-oxd` |

---

## Files Changed

```text
backend/app/services/bulk_data_fetcher.py
backend/app/services/price_cache_service.py
backend/tests/unit/test_market_worker_config.py
backend/tests/unit/test_yahoo_batch_ingestion.py
docker-compose.yml
frontend/.dockerignore
frontend/src/components/Charts/CandlestickChart.jsx
frontend/src/components/Charts/candlestickData.js
frontend/src/components/Charts/candlestickData.test.js
```

---

## Result

The daily chart pipeline is working again and exposes its actual market-data date.
The repaired stack provides latest-completed-day charts, not real-time charts. Delayed
intraday support remains separate work under `stockscreenclaude-m4l`, and the 124
provider-rejected symbols are tracked under `stockscreenclaude-jm9`.

