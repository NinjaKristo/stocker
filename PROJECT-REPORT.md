# PROJECT REPORT

`codex resume -C "C:\Users\micro\github\FINANCE\stock-screener" 019f66bb-57c3-7483-8cf9-c35c63143e8c`

> Stock Screener project status and operating handoff  
> Last updated: 2026-07-20

---

## 1. Current Status

The application is operational as a Docker-based stock scanner with a React/Vite
frontend, FastAPI backend, PostgreSQL storage, Redis cache, and Celery workers.

The latest completed repair addresses charts that were 10 to 11 days old. The daily
price-refresh worker had been crashing before it could persist fresh bars. The repaired
worker completed a live US-market refresh without the prior crash, and 9,973 symbols
now contain a July 16, 2026 daily bar.

Charts now provide two honest freshness levels:

- Daily and weekly views use durable end-of-day data and display `Data through <date>`.
- Interactive charts can switch to `HOURLY`, which fetches one month of public delayed
  60-minute bars and displays the source plus the actual latest bar time.

Neither mode is labeled real-time. A browser reload cannot be mistaken for a new market
bar.

### Delivery status

| Item | Status |
|---|---|
| Repair branch | `stocker/fix/daily-chart-freshness` |
| Repair commit | `09a3da6b` (`fix: restore daily chart freshness`) |
| Remote status | Pushed |
| Live worker | Running with the repaired solo-pool configuration |
| Daily-bar coverage | 9,973 US symbols with a July 16, 2026 bar |
| Acceptance tickers | SPY, AAPL, MSFT, NVDA, and AMZN all verified through July 16 |
| Hourly chart branch | `feat/hourly-delayed-chart` |
| Hourly chart status | Implemented, tested, and deployed from the local main working state |
| Real-time streaming quotes | Not implemented |

The daily freshness repair is merged into `main`. The hourly addition was built from
the actual local main working state so the TradingView links, chart navigation, and
other local UI work remained present. Existing PostgreSQL and Redis volumes were
preserved.

---

## 2. How To Run

For normal use, double-click:

```text
CJN-LAUNCH.bat
```

`CJN-LAUNCH.bat` is the project's one-click launcher. The application should be used
through this launcher rather than the disposable `CJN-TEST` sandbox.

---

## 3. What The Data Repairs Changed

1. **Made the market-data worker process-safe.** The `celery-datafetch` service now
   uses Celery's solo pool with one worker, matching the process-wide Yahoo HTTP
   session used by the application.
2. **Normalized Yahoo price frames.** Flat and MultiIndex yfinance responses are
   converted into one canonical OHLCV format before caching or persistence.
3. **Made PostgreSQL the durable source of truth.** Daily bars are committed to the
   database before Redis is updated. Database errors now roll back and fail the task
   instead of reporting false success.
4. **Removed a fragile pandas row path.** Persistence uses canonical rows and
   `itertuples`, avoiding the corrupted iterator behavior seen in the crashing worker.
5. **Exposed the actual chart date.** Shared candlestick charts show the newest market
   bar date separately from the time the page fetched the cached response.
6. **Made frontend Docker builds platform-safe.** `frontend/.dockerignore` prevents
   Windows `node_modules` binaries from being copied into Linux images.
7. **Added a separate delayed intraday contract.** The backend returns 60-minute
   timestamped bars with source, cache, fetch-time, latest-bar, and `is_realtime: false`
   metadata without writing intraday bars into the durable daily cache.
8. **Added `HOURLY` to shared interactive charts.** The chart disables weekly
   aggregation and RS overlays in intraday mode, converts timestamps correctly, and
   displays the provider plus actual latest-bar time.
9. **Protected the provider and backend.** Intraday responses use a 60-second Redis
   cache, the existing distributed Yahoo rate limiter, and a worker thread so provider
   latency does not block FastAPI's event loop.

Full implementation and test evidence is recorded in `RECENT-CHANGE.md`.

---

## 4. Verified Results

### Live data recovery

- The repair was rebuilt into the existing Docker stack without replacing the
  PostgreSQL data volume.
- Celery reported pool `solo` with concurrency `1` for the data-fetch worker.
- Refresh task `52c78bc4-4264-4fb9-b9a8-3e86c03c5878` finished in 153.17 seconds.
- The former `SIGSEGV`, `tuple_iterator`, and `Timestamp` failures did not recur.
- Database coverage improved from a majority of symbols ending on July 6 to 9,973
  symbols containing the July 16 market bar.
- The result was `partial`, not falsely reported as complete: 124 symbols were
  rejected by the upstream provider and need reconciliation.

### Quality gates

| Gate | Result |
|---|---|
| Focused backend tests | 108 passed, 3 skipped |
| New frontend date tests | 2 passed |
| Frontend lint | Passed with 8 pre-existing warnings and 0 errors |
| Frontend production build | Passed |
| Frontend Docker build | Passed after adding `.dockerignore` |
| Live chart check | Five representative charts rendered with `Data through Jul 16, 2026` |
| Hourly backend tests | 7 passed across service and endpoint contracts |
| Hourly frontend tests | 6 passed across API, timestamp, and selector behavior |
| Live hourly-data check | AAPL returned 138 delayed 60-minute bars; miss then Redis hit |

---

## 5. Known Limitations And Follow-Up

| Issue | Purpose |
|---|---|
| `stockscreenclaude-jm9` | Reconcile 124 provider-rejected US price symbols |
| `stockscreenclaude-ob3` | Add Router context to existing ResultsTable tests |
| `stockscreenclaude-03c` | Remove hardcoded live-server dependency from backend test collection |
| `stockscreenclaude-oxd` | Stabilize the unrelated theme model-selection unit test |
| `stockscreenclaude-dla` | Make stale FX quote tests correct on weekends |

The full frontend and backend suites have pre-existing failures described in
`RECENT-CHANGE.md`. They are separated from the tests for this repair so the report
does not claim a clean repository-wide suite where one does not exist.

---

## 6. Data Expectations

- **Current capability:** daily end-of-day OHLCV bars plus on-demand 60-minute
  delayed bars for interactive charts.
- **Expected freshness:** the latest completed market day after the scheduled refresh
  succeeds.
- **Not current capability:** exchange-grade real-time streaming quotes.
- **How to judge a chart:** read the `Data through` label. The page load time only says
  when the cache was read; it does not say when the market bar was produced.
- **How to use intraday:** select `HOURLY` and read the `bar <time>` label. It
  identifies the latest provider bar, while `loaded <time>` identifies the request.
