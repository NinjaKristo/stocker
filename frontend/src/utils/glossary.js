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
 *    CANSLIM, VCP, ...), including technical app/file terms users encounter.
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

  // --- application / data terms shown in controls and reports ---
  'USD': {
    name: 'United States Dollar',
    summary: 'The common currency used to normalize values across different stock markets.',
    where: 'Market-cap filters, scan results, Backplay budgets and reports',
    use: 'USD normalization makes liquidity and company size comparable across markets.',
  },
  'API': {
    name: 'Application Programming Interface',
    summary: 'A defined way for the app screen, backend, or another service to exchange data and commands.',
    where: 'Settings, connection errors, operations and assistant configuration',
    use: 'An API error means the screen could not complete its request to the underlying service.',
  },
  'URL': {
    name: 'Uniform Resource Locator',
    summary: 'The address used to locate a page or network service.',
    where: 'Source management, model settings and connection configuration',
    use: 'Use the exact service URL so the app connects to the intended local or remote endpoint.',
  },
  'JSON': {
    name: 'JavaScript Object Notation',
    summary: 'A structured text format used to export, import, and exchange application data.',
    where: 'Settings backup, assistant tool details and diagnostics',
    use: 'JSON exports preserve structured records instead of flattening them into display text.',
  },
  'CSV': {
    name: 'Comma-Separated Values',
    summary: 'A plain-text table format that spreadsheet programs can open.',
    where: 'Scan exports, article exports and watchlist import/export',
    use: 'Use CSV to move symbols and report rows between the screener and a spreadsheet.',
  },
  'LLM': {
    name: 'Large Language Model',
    summary: 'An AI model trained on text and used here for assistant and theme-analysis tasks.',
    where: 'Assistant settings, theme analysis and model selection',
    use: 'The selected LLM affects response quality, speed, privacy, and operating cost.',
  },
  'AI': {
    name: 'Artificial Intelligence',
    summary: 'Software that performs tasks such as language analysis, ranking, or explanation generation.',
    where: 'Assistant, model settings and generated research',
    use: 'Treat AI output as research support and verify it before making a trading decision.',
  },
  'TTM': {
    name: 'Trailing Twelve Months',
    summary: 'A financial value calculated from the most recent twelve months of reported results.',
    where: 'Stock fundamentals and peer metrics',
    use: 'TTM values stay more current than the last completed fiscal year.',
  },
  'QoQ': {
    name: 'Quarter over Quarter',
    summary: 'Change from the latest reported quarter compared with the preceding quarter.',
    where: 'Earnings and sales growth metrics',
    use: 'QoQ highlights near-term acceleration or deceleration in company results.',
  },
  'Q/Q': {
    name: 'Quarter over Quarter',
    summary: 'Change from one reported quarter to the next.',
    where: 'Stock-detail and scan growth labels',
    use: 'Quarterly comparisons reveal recent business momentum.',
  },
  'Y/Y': {
    name: 'Year over Year',
    summary: 'Change from a period compared with the same period one year earlier.',
    where: 'Stock-detail and scan growth labels',
    use: 'Year-over-year comparisons reduce seasonal distortion in growth rates.',
  },
  'U/D': {
    name: 'Up/Down Volume Ratio',
    summary: 'Trading volume on advancing sessions compared with volume on declining sessions.',
    where: 'Scan filters and stock accumulation metrics',
    use: 'A higher ratio suggests buying demand is stronger than selling pressure.',
  },
  'OHLC': {
    name: 'Open, High, Low, Close',
    summary: 'The four price points that summarize one chart period.',
    where: 'Price-chart legends and chart settings',
    use: 'OHLC values show the full price range and closing location for each bar.',
  },
  'OHLCV': {
    name: 'Open, High, Low, Close, Volume',
    summary: 'Standard price-bar data plus the number of shares traded during the period.',
    where: 'Chart loading and diagnostics',
    use: 'OHLCV supplies both price action and the participation behind it.',
  },
  'ID': {
    name: 'Identifier',
    summary: 'A unique value used to distinguish a task, record, or other application object.',
    where: 'Operations, task status and diagnostics',
    use: 'Use the ID to trace the exact task or record when troubleshooting.',
  },
  'ADV': {
    name: 'Average Daily Volume',
    summary: 'The average number or dollar value of shares traded per day, depending on the label.',
    where: 'Liquidity filters and scan results',
    use: 'Higher ADV generally means easier entries and exits with less price impact.',
  },
  'ATR14': {
    name: '14-Period Average True Range',
    summary: 'Average true range calculated over the latest fourteen chart periods.',
    where: 'Setup Engine risk and volatility details',
    use: 'ATR14 estimates normal movement so stops can sit outside routine price noise.',
  },
  'EMA10': {
    name: '10-Period Exponential Moving Average',
    summary: 'A fast moving average that gives more weight to the latest ten periods.',
    where: 'Charts and technical-distance filters',
    use: 'EMA10 is useful for tracking the short-term trend of fast leaders.',
  },
  'EMA20': {
    name: '20-Period Exponential Moving Average',
    summary: 'A responsive moving average based on the latest twenty periods.',
    where: 'Charts and technical-distance filters',
    use: 'EMA20 often acts as near-term support during an orderly advance.',
  },
  'EMA50': {
    name: '50-Period Exponential Moving Average',
    summary: 'An intermediate trend average weighted toward more recent prices.',
    where: 'Charts and technical-distance filters',
    use: 'EMA50 helps distinguish normal pullbacks from broader trend damage.',
  },
  'ETA': {
    name: 'Estimated Time of Arrival',
    summary: 'The projected time remaining before a running scan or task finishes.',
    where: 'Scan progress and operations status',
    use: 'ETA is an estimate and can change as task throughput changes.',
  },
  'BT': {
    name: 'Breakthrough',
    summary: 'Short label for the Volume Breakthrough screener and its score.',
    where: 'Scan filters and result columns',
    use: 'Volume breakthroughs flag unusually strong participation that may precede follow-through.',
  },
  'PEG': {
    name: 'Price/Earnings-to-Growth Ratio',
    summary: 'The price/earnings ratio divided by expected earnings growth.',
    where: 'Stock valuation metrics',
    use: 'PEG adds growth context to valuation, but is most useful within comparable industries.',
  },
  'P/L': {
    name: 'Profit and Loss',
    summary: 'Money gained or lost by a trade, strategy, or account.',
    where: 'Backplay and Paper Trader reports',
    use: 'Dollar P/L shows the account impact that a percentage return can hide.',
  },
  'FX': {
    name: 'Foreign Exchange',
    summary: 'The market where one currency is priced and traded against another.',
    where: 'TradingView-formatted watchlist symbols',
    use: 'The FX prefix identifies currency-pair symbols rather than listed stocks.',
  },
  'MM': {
    name: 'Market Monitor',
    summary: 'StockBee breadth dashboard showing daily counts of strong and weak market action.',
    where: 'Daily page Stockbee MM tab',
    use: 'The Market Monitor gives a quick read on participation beneath the major indexes.',
  },
  '1D': {
    name: 'One Day',
    summary: 'A measurement covering one trading session.',
    where: 'Performance bars, charts and market summaries',
    use: 'Use the one-day view for the latest move, not the longer trend.',
  },
  '1W': {
    name: 'One Week',
    summary: 'A measurement covering approximately five trading sessions.',
    where: 'Group rankings, performance bars and charts',
    use: 'The one-week view highlights immediate leadership changes.',
  },
  '2W': {
    name: 'Two Weeks',
    summary: 'A measurement covering approximately ten trading sessions.',
    where: 'Performance bars and chart controls',
    use: 'Two weeks smooths single-session noise while remaining responsive.',
  },
  '1M': {
    name: 'One Month',
    summary: 'A measurement covering approximately one month of trading.',
    where: 'Relative-strength metrics, performance bars and charts',
    use: 'One-month performance shows short-term trend persistence.',
  },
  '3M': {
    name: 'Three Months',
    summary: 'A measurement covering approximately one quarter of trading.',
    where: 'Relative-strength metrics, performance bars and charts',
    use: 'Three months captures intermediate momentum without relying on one week.',
  },
  '6M': {
    name: 'Six Months',
    summary: 'A measurement covering approximately half a year of trading.',
    where: 'Performance bars, charts and IPO-age controls',
    use: 'Six-month performance helps confirm sustained leadership.',
  },
  '12M': {
    name: 'Twelve Months',
    summary: 'A measurement covering approximately one year of trading.',
    where: 'Relative-strength metrics, performance bars and charts',
    use: 'Twelve months provides long-horizon context for the current move.',
  },
  '1Y': {
    name: 'One Year',
    summary: 'A measurement or age window covering one year.',
    where: 'Chart ranges, breakthrough periods and IPO-age controls',
    use: 'The one-year view shows a full market-cycle season of price history.',
  },
  '2Y': {
    name: 'Two Years',
    summary: 'A measurement or age window covering two years.',
    where: 'Chart ranges and IPO-age controls',
    use: 'Two years adds context around bases and post-IPO development.',
  },
  '3Y': {
    name: 'Three Years',
    summary: 'A measurement or age window covering three years.',
    where: 'Chart ranges and IPO-age controls',
    use: 'Three years provides broader context for trend and business cycles.',
  },
  '5Y': {
    name: 'Five Years',
    summary: 'A measurement or age window covering five years.',
    where: 'Chart ranges, breakthrough periods and IPO-age controls',
    use: 'Five years reveals whether current strength is exceptional in a long history.',
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

// Curated terms safe to annotate automatically inside free text. Boundary
// lookarounds support punctuation-heavy labels without matching word fragments.
export const AUTO_TERMS = [
  'ADV ($)', 'EPS Rtg', 'RS Trend', 'OHLCV', 'CANSLIM', 'Minervini',
  'RSBD', 'SEBD', 'RVOL', 'VWAP', 'GICS', 'RRG', 'RSI', 'ATR', 'ADR', 'ADV',
  'ROE', 'VCP', 'SMA', 'EMA', 'IPO', 'SPY', 'ETF', 'IBD', 'DMA', 'VIX', 'FTD',
  'NR7', 'MFE', 'MAE', 'EPS', 'RS', 'MA', 'EP', '5D', '10D', 'USD', 'API',
  'URL', 'JSON', 'CSV', 'LLM', 'AI', 'TTM', 'QoQ', 'Q/Q', 'Y/Y', 'U/D',
  'OHLC', 'ID', 'SE', 'CAN', 'VolB', 'Sqz', 'Stg', 'βRS', 'β', 'ATR14',
  'EMA10', 'EMA20', 'EMA50', 'ETA', 'BT', 'PEG', 'P/L', 'P/E', 'P/S', 'FX',
  'MM', '1D', '1W', '2W', '1M', '3M', '6M', '12M', '1Y', '2Y', '3Y', '5Y',
];

const AUTO_TERM_PATTERN = new RegExp(
  `(?<![A-Za-z0-9])(${AUTO_TERMS
    .slice()
    .sort((left, right) => right.length - left.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')}|\\d+\\s?[dDwWmMyY])(?![A-Za-z0-9])`,
  'g',
);

/** Known glossary terms in display text, including positions for safe wrapping. */
export function findGlossaryMatches(text) {
  const value = String(text ?? '');
  const matches = [];
  AUTO_TERM_PATTERN.lastIndex = 0;
  let match;
  while ((match = AUTO_TERM_PATTERN.exec(value)) !== null) {
    const entry = lookupGlossaryEntry(match[0]);
    if (entry) {
      matches.push({ term: match[0], start: match.index, end: match.index + match[0].length, entry });
    }
  }
  return matches;
}

/** Full entry ({name, summary, where, use}) or null. */
export function lookupGlossaryEntry(term) {
  const key = String(term ?? '').trim();
  if (!key) return null;
  if (GLOSSARY[key]) return GLOSSARY[key];
  const upper = key.toUpperCase();
  const hit = Object.keys(GLOSSARY).find((k) => k.toUpperCase() === upper);
  if (hit) return GLOSSARY[hit];

  const period = key.match(/^(\d+)\s*([DWMY])$/i);
  if (!period) return null;
  const count = Number(period[1]);
  const units = { D: 'Day', W: 'Week', M: 'Month', Y: 'Year' };
  const unit = units[period[2].toUpperCase()];
  const label = `${count} ${unit}${count === 1 ? '' : 's'}`;
  return {
    name: label,
    summary: `A measurement window covering ${label.toLowerCase()} of market or company data.`,
    where: 'Chart ranges, performance columns, lookback controls and report metrics',
    use: 'The window length tells you whether a metric reflects immediate action or a longer trend.',
  };
}

/** Back-compat: short hover text ("Name — summary") or null. */
export function lookupGlossary(term) {
  const entry = lookupGlossaryEntry(term);
  return entry ? `${entry.name} — ${entry.summary}` : null;
}

export default GLOSSARY;
