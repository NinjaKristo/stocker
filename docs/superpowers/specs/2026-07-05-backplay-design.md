# Backtest / Backplay / Paper Trader — design

Date: 2026-07-05. Covers tasks.md **#7** (all four asks) and the shared engine they sit on.
Written for autonomous implementation; every decision below is a *switchable default* —
nothing locks the user in.

## Plain-language goal

Today the Backtest tab only *grades* past scan picks (a report card). The user wants to
actually **run experiments**: "if I had bought stock X using rule Y, what would have
happened?" — and a **practice mode** that keeps running on live data without real money.

## What gets built

One shared **strategy engine** (backend) with four faces:

| Face | What it does |
|------|--------------|
| **Scorecard** (#7a) | The original platform, kept as-is but made executable: run controls, plain-language explanation, and per-ticker "Backplay this" jump-offs. |
| **Backplay — Replay** (mode 1) | TradingView-style bar replay: chart plays forward one day at a time; user presses Buy/Sell; running profit shown. Frontend-only game over real history. |
| **Backplay — Strategy Test** (mode 3) | One ticker + date range + a rule → engine simulates trades → summary, equity curve, trade list. |
| **Backplay — Scan Top 10** (mode 2) | Pick a scan preset (built-in or user-saved) → top 10 by that preset's score → run the same strategy test on each → per-ticker + combined results. |
| **Paper Trader** (#7.4) | A saved rule (script) runs on new market data daily until stopped. Finds entries (single ticker or scan2trade: preset → candidates → entry rule), tracks open trades, closes them by rule, logs every event in rows that expand on click. |

## Strategy definition (shared by Backplay + Paper Trader)

Two kinds, both stored the same way:

1. **Built-in strategies** (beginner-facing, parameterized, plain-language descriptions):
   - `breakout` — buy when price closes above its highest close of the last N days (default 20); sell when it closes below the lowest close of the last M days (default 10).
   - `ma_cross` — buy when the fast average (default 10-day) crosses above the slow one (default 50-day); sell on the reverse cross.
   - `buy_hold` — buy on day one, sell at the end (the benchmark).
2. **Script strategies** — a small thinkorswim-style (thinkScript-inspired) language:
   - Series: `open, high, low, close, volume`
   - Functions: `SMA(x, n)`, `EMA(x, n)`, `RSI(n)`, `ATR(n)`, `Highest(x, n)`, `Lowest(x, n)`
   - Operators: `+ - * /`, comparisons, `and`, `or`, `not`, `crosses above`, `crosses below`
   - Example entry: `close crosses above Highest(close, 20) and volume > 1.5 * SMA(volume, 50)`
   - Implemented as tokenizer → recursive-descent parser → AST → vectorized pandas eval.
     No Python `eval`; unknown names are parse errors. Grammar module: `services/backplay/script_engine.py`.

Every strategy also carries optional **guardrails**: stop loss % (sell if it drops X% below
entry), take profit % (sell after gaining Y%), max hold days.

## Engine mechanics (`services/backplay/engine.py`)

- Daily bars from `PriceCacheService.get_cached_only(symbol, period="5y")` — cache-only, never hits Yahoo.
- Decisions on bar close → fill at **next bar's open** (no peeking at the future).
- Stop/target checked intrabar via high/low; when both could fire the same day, the stop wins (conservative).
- Long-only, one position at a time, all-in from a $10,000 starting balance (simple mental model).
- Outputs: trades list (entry/exit date+price, % result, exit reason), equity curve, summary
  (total return %, buy-and-hold return % for comparison, number of trades, win rate,
  average win, average loss, max drawdown).

## Backend surface

New tables (one Alembic migration, `20260705_0023_add_backplay_and_paper_tables`):

- `backplay_strategies` — saved strategies (name, kind, params_json, entry_script,
  exit_script, stop_loss_pct, take_profit_pct, max_hold_days, timestamps).
- `backplay_runs` — completed backtests (mode, params_json, results_json, status, error,
  timestamps). Runs execute synchronously in the request (pandas over cached bars is fast);
  history persists so past runs list instantly.
- `paper_setups` — the ongoing experiments (name, strategy fields as above, source: single
  symbol or preset ref, position size, status active/stopped, market, timestamps).
- `paper_trades` — one row per trade (setup FK, symbol, entry/exit date+price, qty, status
  open/closed, result %, exit reason, events_json for the expandable detail timeline).

Endpoints (`api/v1/backplay.py`, `api/v1/paper.py`, wired in `router.py`):

- `POST /v1/backplay/run` — `{mode: single|scan_top10, symbol?, preset_key?, start, end, strategy}` → results.
- `GET /v1/backplay/runs` / `GET /v1/backplay/runs/{id}` — history.
- `GET /v1/backplay/presets` — merged list: built-in `PRESET_SCREENS` + user `FilterPreset` rows.
- CRUD `/v1/backplay/strategies`; `POST /v1/backplay/validate-script` for live script feedback.
- CRUD `/v1/paper/setups`, `POST /v1/paper/setups/{id}/stop`, `GET /v1/paper/trades?setup_id=`,
  `POST /v1/paper/evaluate` (manual "check now", same code the scheduler calls).

Scan Top 10 stock selection: latest published `FeatureRun` (pointer) →
`SqlFeatureStoreRepository.query_all_as_scan_results` → serialize →
`_matches_preset_filters(row, preset["filters"])` → sort by the preset's `sort_by` → first 10.
Known simplification (stated in the UI): stocks are chosen by **today's** scan, then tested
backwards — good for "does my rule work on the kind of stock this scan finds", not a
point-in-time simulation.

Paper trader evaluation: Celery beat task `app.tasks.paper_trading_tasks.evaluate_paper_setups`
daily after the US cache warm (offset +45 min), queue `celery`, cache-only reads. Each active
setup: resolve candidates (symbol or preset top-N), evaluate entry rule on the latest bar,
open trades at next-day open price convention (recorded when the bar arrives), check exits on
open trades, append events to `events_json`.

## Frontend

`/validation` route keeps its URL; nav label stays **Backtest**. Page becomes three tabs:

1. **Scorecard** — existing panels + a control bar that reads as executable (source,
   lookback, explicit **Run** button) + beginner copy explaining what it grades + each
   event row gets a ▶ button that opens Strategy Test pre-filled with that ticker.
2. **Backplay** — sub-mode toggle: **Replay** / **Strategy Test** / **Scan Top 10**.
   - Replay: `lightweight-charts` candlestick fed bar-by-bar; Play/Pause/Step/Speed; Buy/Sell
     buttons; position + running balance card; trade markers on the chart; end-of-run summary.
     Data from existing `GET /v1/stocks/{symbol}/history?period=5y`.
   - Strategy Test: ticker + date range + strategy picker (built-ins with plain-language
     blurbs, or script editor with validate-as-you-type) → results: summary cards, equity
     curve vs buy-and-hold, trades table.
   - Scan Top 10: preset picker + strategy + date range → per-ticker results table
     (expandable to the single-ticker detail) + combined summary.
3. **Paper Trader** — setups table (status chips, start/stop), "New setup" dialog
   (name → what to trade: one ticker or a scan preset → the rule: built-in or script →
   guardrails), trades log with expandable rows (entry/exit, reason, event timeline).

New files under `frontend/src/features/backplay/` (api client `frontend/src/api/backplay.js`,
`paper.js`). All new labels wrapped in glossary hovers.

## tasks.md #2 — glossary sweep (separate workstream)

Wrap remaining page headers/labels with `<Acronym>`/`<GlossaryText>`: Breadth, the whole
new Backtest page, Daily tab tables, Themes tables, Stock Detail. Add missing glossary
entries encountered along the way (e.g. MFE, MAE, equity curve, drawdown, win rate,
paper trading, stop loss, take profit).

## Testing

- Backend: unit tests for script engine (parse/eval/errors), engine mechanics (fill at next
  open, stop-before-target, max-hold), scan-top-10 selection (preset filter + ranking),
  paper evaluation transitions (no-entry, entry, exit, stop). Run in Docker
  (`docker compose run --user root -v ${PWD}/backend:/app backend pytest tests/unit/...`).
- Frontend: vitest for the new page tabs (render, mode switching, run flow with mocked API),
  replay reducer logic (buy/sell/step bookkeeping) as a plain unit test.

## Out of scope (YAGNI, revisit on request)

Intraday bars, shorting, multiple simultaneous positions, commissions/slippage models,
portfolio-level paper trading, thinkScript full compatibility, real broker hookups.
