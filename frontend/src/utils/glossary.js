/**
 * Glossary of *trading-industry* acronyms with hover definitions.
 *
 * Each entry: { name, summary, where, use }
 *  - name    — the spelled-out term (shown bold in the hover bubble)
 *  - summary — one-sentence plain-language explanation
 *  - where   — where it appears / should be used in the app
 *  - use     — how it helps a low-volume, one-trade-a-day trader
 *
 * Rules:
 *  - Keep genuine acronyms / strategy names / industry terms (RS, EPS, ATR,
 *    CANSLIM, VCP, …). NOT plain word-shortenings (Vol→Volume, USD, Sales).
 *  - Terms NOT in this map simply render as plain text (no tooltip).
 *
 * Keys are matched case-insensitively; the exact scan column labels that are
 * real acronyms are included verbatim so those headers light up.
 */
const GLOSSARY = {
  // --- core ratings / values ---
  'RS': {
    name: 'Relative Strength',
    summary: 'Excess return vs the market benchmark, weighted across 3/6/9/12-month periods and scaled 0–100.',
    where: 'Scan columns, Groups rankings, Stock Detail, most screeners',
    use: 'Filter to RS ≥ 70–80 so your single daily trade is always in a proven leader, not a laggard.',
  },
  'RS Trend': {
    name: 'Relative Strength Trend',
    summary: 'Direction the RS rating is moving (up / flat / down) over recent sessions.',
    where: 'Watchlists, Stock Detail',
    use: 'Prefer entries where RS is rising — strength that is still building.',
  },
  'RSBD': {
    name: 'RS-line Blue Dot',
    summary: 'Fires when the RS line hits a 252-session high before price does — leadership showing up before the breakout.',
    where: 'Scan results (RSBD column), chart modal markers, Blue Dot Leaders preset',
    use: 'An early-warning list: candidates likely to break out soon, worth stalking for your one trade.',
  },
  'SEBD': {
    name: 'Setup Engine Blue Dot',
    summary: "The Setup Engine's setup-specific RS blue-dot flag on the current pattern.",
    where: 'Scan results (SEBD column)',
    use: 'Confirms leadership inside a detected chart setup — pattern plus strength together.',
  },
  'EPS': {
    name: 'Earnings Per Share',
    summary: 'Company profit divided by shares outstanding — the core growth yardstick.',
    where: 'Scan filters (EPS growth), CANSLIM screener, Stock Detail fundamentals',
    use: 'Growth ≥ 25% QoQ marks real fundamental power behind a move — fewer false breakouts.',
  },
  'EPS Rtg': {
    name: 'Earnings Per Share Rating',
    summary: 'Percentile rank (0–99) of earnings growth vs all stocks.',
    where: 'Scan columns, Stock Detail',
    use: 'One glance tells you whether earnings back the chart.',
  },
  'β': {
    name: 'Beta',
    summary: 'Volatility vs the market — 1.0 moves with it, higher means bigger swings.',
    where: 'Scan filters (Technical), Stock Detail',
    use: 'Size positions down on high-beta names so one trade cannot wreck the week.',
  },
  'βRS': {
    name: 'Beta-adjusted Relative Strength',
    summary: 'RS corrected for the stock’s volatility, so wild movers don’t fake strength.',
    where: 'Scan columns',
    use: 'Finds genuine leaders rather than just the most volatile tickers.',
  },
  'ADR': {
    name: 'Average Daily Range',
    summary: 'Average percent range of a day’s trading — how much the stock travels in a session.',
    where: 'Scan columns/filters, Tight Setups preset',
    use: 'Match stops to ADR: a stop tighter than one day’s range gets hit by noise.',
  },
  'ADV ($)': {
    name: 'Average Daily Dollar Volume',
    summary: 'Average dollars traded per day — shares × price, the liquidity measure.',
    where: 'Scan columns/filters',
    use: 'Stay above ~$20M so your entry/exit never moves the price on you.',
  },
  'ATR': {
    name: 'Average True Range',
    summary: 'Average absolute price movement per day (14-day), including gaps.',
    where: 'Scan filters, Stock Detail chart',
    use: 'Set stops at 1–2× ATR below entry — outside normal noise, inside disaster range.',
  },
  'RSI': {
    name: 'Relative Strength Index',
    summary: 'Momentum oscillator 0–100; >70 often stretched, <30 washed out (distinct from RS rating).',
    where: 'Scan filters (Technical), Stock Detail chart',
    use: 'Avoid buying breakouts already stretched above RSI 75 — late entries make losing trades.',
  },
  'RVOL': {
    name: 'Relative Volume',
    summary: 'Today’s volume vs its average — 2.0 means twice normal trade.',
    where: 'Scan filters, Volume Breakthrough screener',
    use: 'Only take breakouts on RVOL ≥ 1.5 — volume is the conviction behind the move.',
  },
  'VWAP': {
    name: 'Volume-Weighted Average Price',
    summary: 'Average price traded through the day, weighted by volume — a “true value” indicator (standard or anchored).',
    where: 'Intraday charts / entry timing',
    use: 'Enter above VWAP with the buyers, not below it against them; anchored VWAP from a breakout day acts as support.',
  },
  'ROE': {
    name: 'Return on Equity',
    summary: 'Profit generated per dollar of shareholder equity — quality of the business.',
    where: 'Scan filters (Profitability), Stock Detail fundamentals',
    use: 'ROE ≥ 17% separates institution-grade growers from junk rallies.',
  },
  'P/E': {
    name: 'Price / Earnings',
    summary: 'Price paid per dollar of annual earnings — the classic valuation ratio.',
    where: 'Scan filters (Valuation), Stock Detail',
    use: 'Growth leaders run high P/E — use it as context, not a veto.',
  },
  'P/S': {
    name: 'Price / Sales',
    summary: 'Market cap per dollar of revenue — valuation for not-yet-profitable growers.',
    where: 'Scan filters (Valuation)',
    use: 'Compare within an industry group, not across the whole market.',
  },
  'MCap': {
    name: 'Market Capitalization',
    summary: 'Total value of all shares — price × shares outstanding.',
    where: 'Scan columns/filters, Stock Detail fundamentals',
    use: 'Mid/large caps move cleaner; tiny caps gap through stops — size accordingly.',
  },
  'MFE': {
    name: 'Maximum Favorable Excursion',
    summary: 'The best unrealized gain a trade showed before it closed.',
    where: 'Backtest metrics, Stock Detail validation history',
    use: 'If winners routinely ran +8% before closing +2%, your exits are leaving money behind.',
  },
  'MAE': {
    name: 'Maximum Adverse Excursion',
    summary: 'The worst unrealized loss a trade showed before it closed.',
    where: 'Backtest metrics, Stock Detail validation history',
    use: 'Shows how much heat past signals took — set stops wider than typical MAE or get shaken out.',
  },
  '5D': {
    name: 'Five-Day',
    summary: 'A rolling five-trading-session measurement window.',
    where: 'Breadth, daily digest, watchlists, validation metrics',
    use: 'Good for judging whether strength is immediate enough to matter for the next trade.',
  },
  '10D': {
    name: 'Ten-Day',
    summary: 'A rolling ten-trading-session measurement window.',
    where: 'Breadth, daily digest, watchlists, validation metrics',
    use: 'Smooths one-week noise while still staying close to current market action.',
  },

  // --- patterns / structure ---
  'VCP': {
    name: 'Volatility Contraction Pattern',
    summary: 'Minervini base where each pullback gets tighter until supply dries up before breakout.',
    where: 'Setup Engine, VCP Setups preset, Stock Detail technicals',
    use: 'The tight pre-breakout coil gives a defined pivot and a close stop — ideal one-a-day entry.',
  },
  'MA': {
    name: 'Moving Average',
    summary: 'Average closing price over a window (20/50/150/200-day) — the trend’s backbone.',
    where: 'Charts, Minervini screener (50 > 150 > 200 alignment), scan filters',
    use: 'Only buy above an aligned, rising MA stack — trade with the trend, not against it.',
  },
  'SMA': {
    name: 'Simple Moving Average',
    summary: 'Plain average of the last N closes; equal weight to every day.',
    where: 'Charts (SMA 20/50/200), scan filters',
    use: 'The 50-SMA is a leader’s usual pullback floor — a low-risk add/entry zone.',
  },
  'EMA': {
    name: 'Exponential Moving Average',
    summary: 'Moving average that weights recent days more, reacting faster than SMA.',
    where: 'Charts, RRG smoothing',
    use: 'Faster signal for entry timing; 10/21-EMA hold is a common swing trail.',
  },
  'Sqz': {
    name: 'Bollinger Band Squeeze',
    summary: 'Bands pinch when volatility compresses — energy building for a move.',
    where: 'Scan columns',
    use: 'A squeeze plus RS strength flags tomorrow’s mover today — put it on the stalk list.',
  },
  'Stg': {
    name: 'Stage',
    summary: 'Weinstein market stage: 1 base, 2 uptrend, 3 top, 4 decline.',
    where: 'Scan columns/filters, Minervini screener',
    use: 'Only trade Stage 2 — one rule that removes most losing longs.',
  },
  'Stage': {
    name: 'Market Stage (Weinstein)',
    summary: 'Cycle position: 1 base, 2 uptrend, 3 top, 4 decline.',
    where: 'Scan columns/filters, Minervini screener',
    use: 'Only trade Stage 2 — one rule that removes most losing longs.',
  },
  'NR7': {
    name: 'Narrowest Range 7',
    summary: 'The narrowest daily range of the last 7 sessions — coiled volatility.',
    where: 'Setup Engine (NR7 / Inside Day preset)',
    use: 'Tight trigger day = small stop and a defined breakout level for the next session.',
  },

  // --- strategies / screeners ---
  'CANSLIM': {
    name: 'CANSLIM (O’Neil)',
    summary: 'Seven-factor growth method: earnings, new highs, volume, leadership, institutions, market direction.',
    where: 'Scan screener + preset, Daily leaders',
    use: 'A complete checklist so your one pick has earnings, leadership, and market tailwind together.',
  },
  'CAN': {
    name: 'CANSLIM Screener Score',
    summary: 'This app’s 0–100 score against the CANSLIM criteria.',
    where: 'Scan results column',
    use: 'Sort by it to shortlist O’Neil-grade candidates instantly.',
  },
  'Min': {
    name: 'Minervini Trend Template',
    summary: 'Stage-2 checklist: price above rising 50/150/200-DMA, RS ≥ 70, well off lows, near highs.',
    where: 'Scan screener + preset, Stock Detail technicals',
    use: 'Guarantees you only look at confirmed uptrends — the highest-probability pond to fish.',
  },
  'Minervini': {
    name: 'Minervini Trend Template',
    summary: 'Stage-2 checklist: price above rising 50/150/200-DMA, RS ≥ 70, well off lows, near highs.',
    where: 'Scan screener + preset, Stock Detail technicals',
    use: 'Guarantees you only look at confirmed uptrends — the highest-probability pond to fish.',
  },
  'VolB': {
    name: 'Volume Breakthrough Screener',
    summary: 'Flags volume exceeding all prior 5-year/1-year/since-IPO highs within the last sessions.',
    where: 'Scan screener + preset',
    use: 'Record volume = institutions arriving; these moves have follow-through worth your one bullet.',
  },
  'SE': {
    name: 'Setup Engine',
    summary: 'Pattern detector (cup-with-handle, VCP, flags…) scoring setup quality and pivot readiness.',
    where: 'Scan results (SE score), pattern presets',
    use: 'Tells you which chart is *ready now* — trade the ready one, watch the rest.',
  },
  'IPO': {
    name: 'Initial Public Offering',
    summary: 'A company’s stock-market debut; young stocks with small floats can make outsized runs.',
    where: 'IPO screener, Recent IPOs preset',
    use: 'The 6-month–2-year post-IPO window is where big winners often build their first base.',
  },
  'EP': {
    name: 'Episodic Pivot',
    summary: 'A gap-up ≥ 10% on ≥ 2× volume from earnings/news that resets the trend (Qullamaggie).',
    where: 'Episodic Pivot preset',
    use: 'One of the few day-one entries worth taking — catalyst, gap, and volume all at once.',
  },

  // --- benchmarks / classification / market internals ---
  'SPY': {
    name: 'S&P 500 ETF',
    summary: 'The default US market benchmark all RS is measured against.',
    where: 'Benchmarks, RS calculations, Breadth overlay',
    use: 'Your market thermometer: fighting a falling SPY halves any setup’s odds.',
  },
  'ETF': {
    name: 'Exchange-Traded Fund',
    summary: 'A fund that trades like a stock (SPY, QQQ, GLD…).',
    where: 'Key Markets, benchmark cards',
    use: 'Read sector/market direction fast without picking a stock.',
  },
  'IBD': {
    name: "Investor's Business Daily",
    summary: 'O’Neil’s research house; source of the ~197 industry-group taxonomy used here.',
    where: 'Groups page, group-rank filters',
    use: 'Leaders cluster in leading groups — pick your one trade from the top 40 groups.',
  },
  'GICS': {
    name: 'Global Industry Classification Standard',
    summary: 'The standard sector/industry taxonomy (11 sectors).',
    where: 'Scan sector filters, Stock Detail',
    use: 'Coarser than IBD groups — good for sector-level include/exclude.',
  },
  'RRG': {
    name: 'Relative Rotation Graph',
    summary: 'Plots each group’s RS level (x) vs RS momentum (y); groups rotate Leading → Weakening → Lagging → Improving.',
    where: 'Groups page (RRG tab)',
    use: 'Buy from Leading/Improving quadrants; the rotation warns you before a hot group cools.',
  },
  'DMA': {
    name: 'Day Moving Average',
    summary: 'A moving average over N trading days (50-DMA, 200-DMA).',
    where: 'Charts, Market Health, Minervini criteria',
    use: 'Price above a rising 200-DMA is the simplest “only trade uptrends” test.',
  },
  'VIX': {
    name: 'Volatility Index',
    summary: 'Expected 30-day S&P volatility — the market’s fear gauge; >20 elevated, >30 panic.',
    where: 'Daily Snapshot cards, Market Health score',
    use: 'High VIX = smaller size or stand aside; whipsaw kills one-trade-a-day accounts.',
  },
  'FTD': {
    name: 'Follow-Through Day',
    summary: 'O’Neil’s confirmation: a ≥ 1.5% gain on higher volume 4+ days into a rally attempt.',
    where: 'Market Health recovery heuristic',
    use: 'The green light to resume buying after a correction — don’t front-run it.',
  },

  // --- backtesting / paper trading (Backtest tab) ---
  'Backtest': {
    name: 'Backtest',
    summary: 'Running a trading rule against past prices to see what it would have earned or lost.',
    where: 'Backtest tab (Scorecard, Backplay)',
    use: 'Rehearse a rule on history before risking a single real trade on it.',
  },
  'Backplay': {
    name: 'Backplay',
    summary: 'This app’s backtest lab: replay a chart bar by bar, test a rule on one stock, or test it on a scan’s top 10.',
    where: 'Backtest tab → Backplay',
    use: 'Practice entries and exits with zero risk until the rule feels mechanical.',
  },
  'Bar Replay': {
    name: 'Bar Replay',
    summary: 'The chart plays forward one day at a time and you press Buy/Sell as it unfolds — like TradingView’s replay.',
    where: 'Backtest tab → Backplay → Replay',
    use: 'Trains your eye without hindsight: you can’t see tomorrow’s bars before deciding.',
  },
  'Equity Curve': {
    name: 'Equity Curve',
    summary: 'Your account value plotted over time during a test — up and to the right is the goal.',
    where: 'Backplay results',
    use: 'A choppy, deep-dipping curve means the rule will be emotionally hard to follow live.',
  },
  'Drawdown': {
    name: 'Drawdown',
    summary: 'The worst peak-to-valley drop in account value during a test.',
    where: 'Backplay results (Max Drawdown)',
    use: 'If the worst drop would make you quit the strategy, size down or tighten the exit.',
  },
  'Win Rate': {
    name: 'Win Rate',
    summary: 'Share of trades that ended positive — 0.60 means 6 winners out of 10.',
    where: 'Backplay results, Paper Trader stats',
    use: 'Win rate alone lies: pair it with average win vs average loss size.',
  },
  'Stop Loss': {
    name: 'Stop Loss',
    summary: 'A preset "sell if it drops X% below my entry" safety exit.',
    where: 'Backplay strategy guardrails, Paper Trader',
    use: 'The one non-negotiable: decide the exit before entering, not during the drop.',
  },
  'Take Profit': {
    name: 'Take Profit',
    summary: 'A preset "sell after gaining Y%" exit that banks the win.',
    where: 'Backplay strategy guardrails, Paper Trader',
    use: 'Pair with the stop so each trade has a defined risk-vs-reward before entry.',
  },
  'Paper Trading': {
    name: 'Paper Trading',
    summary: 'Practicing with simulated money on live market data — real decisions, zero risk.',
    where: 'Backtest tab → Paper Trader',
    use: 'Run a rule on paper until it proves itself; only then consider real money.',
  },
  'Buy & Hold': {
    name: 'Buy & Hold',
    summary: 'Buy on day one and keep it to the end — the benchmark every strategy must beat.',
    where: 'Backplay built-in strategies, results comparison',
    use: 'If your rule can’t beat doing nothing, the rule isn’t ready.',
  },
  'Entry Rule': {
    name: 'Entry Rule',
    summary: 'The condition that must be true for the test to buy (e.g. price breaks its 20-day high).',
    where: 'Backplay strategy editor, Paper Trader setups',
    use: 'Written rules remove the "I had a feeling" trades that drain accounts.',
  },
  'Exit Rule': {
    name: 'Exit Rule',
    summary: 'The condition that closes the position (e.g. price falls below its 10-day low).',
    where: 'Backplay strategy editor, Paper Trader setups',
    use: 'Exits matter more than entries — the exit decides what a trade is worth.',
  },
  'Scan2Trade': {
    name: 'Scan-to-Trade',
    summary: 'A combo: a scan preset picks the candidates, then your entry rule decides when to buy one.',
    where: 'Backplay → Scan Top 10, Paper Trader preset setups',
    use: 'Automates the daily funnel: the scan narrows thousands of stocks to a rule-checked few.',
  },
};

// Whole-word terms safe to auto-wrap inside free text (alpha only — avoids
// false hits and special characters like "P/E" or "ADV ($)").
export const AUTO_TERMS = [
  '5D', '10D',
  'RS', 'EPS', 'ATR', 'RSI', 'RVOL', 'VWAP', 'ROE', 'VCP', 'MA', 'SMA', 'EMA',
  'CANSLIM', 'Minervini', 'IPO', 'SPY', 'ETF', 'IBD', 'GICS', 'ADR',
  'RRG', 'RSBD', 'SEBD', 'VIX', 'DMA', 'FTD', 'NR7', 'MFE', 'MAE', 'EP',
];

/** Full entry ({name, summary, where, use}) or null. */
export function lookupGlossaryEntry(term) {
  const key = String(term ?? '').trim();
  if (!key) return null;
  if (GLOSSARY[key]) return GLOSSARY[key];
  const upper = key.toUpperCase();
  const hit = Object.keys(GLOSSARY).find((k) => k.toUpperCase() === upper);
  return hit ? GLOSSARY[hit] : null;
}

/** Back-compat: short hover text ("Name — summary") or null. */
export function lookupGlossary(term) {
  const entry = lookupGlossaryEntry(term);
  return entry ? `${entry.name} — ${entry.summary}` : null;
}

export default GLOSSARY;
