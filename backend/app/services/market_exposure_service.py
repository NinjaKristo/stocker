"""Market exposure ("when to be aggressive") computation.

A transparent, rules-based 0-100 recommended-exposure score for a market,
blended from inputs already in the DB:

  * index OHLCV (distribution days, follow-through day, 50/200-DMA, trend)
  * market breadth (net 4% movers)
  * VIX (US only)

The rubric is intentionally a set of module-level constants — it is a tuning
problem, not an architecture one. Each score contribution is recorded in
``components`` so the UI can show *why* (vs IBD's black box).

Compute-once / store / read-many: the pipeline task calls ``compute_and_store``
daily; the Daily Snapshot payloads (live + static) call ``build_exposure_payload``.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from ..models.market_breadth import MarketBreadth
from ..models.market_exposure import MarketExposure
from ..models.stock import StockPrice

logger = logging.getLogger(__name__)

# --- Distribution day detection -------------------------------------------
DISTRIBUTION_LOOKBACK = 25       # rolling sessions
DISTRIBUTION_DOWN_THRESHOLD = 0.002  # index down >= 0.2%; volume > prior session

# --- Follow-through day (v1 heuristic — see detect_follow_through_day) ------
FTD_GAIN_PCT = 0.015     # >= +1.5% up day
FTD_WINDOW = 15          # look back this many sessions for a qualifying day
FTD_LOW_LOOKBACK = 20    # window used to locate the "recent low"
FTD_MIN_RALLY_DAY = 4    # day 4+ off the recent low (heuristic proxy)

# --- Moving averages / trend ----------------------------------------------
MA_FAST = 50
MA_SLOW = 200

# --- Score rubric (start at 100, apply penalties then caps then FTD floor) --
BASE_SCORE = 100.0

DIST_DAY_PENALTY = 4.0          # subtract per distribution day (always)
NET_4PCT_NEG_PENALTY = 10.0     # net 4% movers negative
VIX_ELEVATED = 20.0             # vix above this -> penalty
VIX_ELEVATED_PENALTY = 8.0
VIX_HIGH = 30.0                 # vix above this -> additional penalty
VIX_HIGH_PENALTY = 12.0

CAP_DISTRIBUTION_5PLUS = 40.0   # >=5 distribution days -> hard cap
CAP_DISTRIBUTION_3_4 = 65.0     # 3-4 distribution days -> moderate cap
CAP_DEATH_CROSS = 55.0          # 50DMA < 200DMA
CAP_BELOW_50DMA = 70.0          # price < 50DMA
CAP_BELOW_200DMA = 45.0         # price < 200DMA

FTD_FLOOR = 50.0                # recent FTD after a correction raises the floor

# Stance bands, highest lower-bound first.
STANCE_BANDS = [
    (85.0, "Power Trend"),
    (65.0, "Confirmed Uptrend"),
    (50.0, "Uptrend Under Pressure"),
    (30.0, "Downtrend/Caution"),
    (0.0, "Correction — In Cash"),
]


def _f(value) -> Optional[float]:
    """Coerce a numpy/pandas scalar to a plain float, or None when missing."""
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return float(value)


def count_distribution_days(
    ohlcv_df: pd.DataFrame,
    lookback: int = DISTRIBUTION_LOOKBACK,
    down_threshold: float = DISTRIBUTION_DOWN_THRESHOLD,
) -> int:
    """Count distribution days in the trailing ``lookback`` window.

    A distribution day is a session where Close fell >= ``down_threshold`` vs
    the prior Close AND Volume exceeded the prior session's Volume. Pure
    function over an OHLCV DataFrame (columns Open/High/Low/Close/Volume).
    Returns 0 on empty/insufficient data.
    """
    if ohlcv_df is None or len(ohlcv_df) < 2:
        return 0
    pct = ohlcv_df["Close"].pct_change()
    vol_up = ohlcv_df["Volume"] > ohlcv_df["Volume"].shift(1)
    mask = (pct <= -down_threshold) & vol_up
    return int(mask.tail(lookback).sum())


def detect_follow_through_day(
    ohlcv_df: pd.DataFrame,
    gain_pct: float = FTD_GAIN_PCT,
    window: int = FTD_WINDOW,
    low_lookback: int = FTD_LOW_LOOKBACK,
    min_rally_day: int = FTD_MIN_RALLY_DAY,
) -> tuple[bool, Optional[date]]:
    """v1 HEURISTIC follow-through-day flag. Returns (found, date_of_ftd).

    CEILING: this is NOT a true IBD follow-through detector — it does not track
    a confirmed rally attempt with a state machine. It flags the most recent
    session within ``window`` where Close rose >= ``gain_pct`` on rising volume,
    occurring at least ``min_rally_day`` sessions after the trailing
    ``low_lookback`` low. It is used only to *raise the score floor* after a
    correction, never to lift the score on its own. Full rally-attempt FSM is v2.
    """
    if ohlcv_df is None or len(ohlcv_df) < min_rally_day + 1:
        return False, None
    close = ohlcv_df["Close"]
    pct = close.pct_change()
    vol_up = ohlcv_df["Volume"] > ohlcv_df["Volume"].shift(1)
    strong_up = (pct >= gain_pct) & vol_up

    low_window = close.tail(low_lookback)
    if low_window.empty:
        return False, None
    low_label = low_window.index[int(low_window.values.argmin())]
    low_pos = ohlcv_df.index.get_loc(low_label)

    candidates = strong_up.tail(window)
    for ts in reversed(list(candidates.index)):
        if not bool(candidates.loc[ts]):
            continue
        if ohlcv_df.index.get_loc(ts) - low_pos >= min_rally_day:
            return True, ts.date()
    return False, None


def compute_trend(ohlcv_df: pd.DataFrame) -> dict:
    """Return {price, ma50, ma200, trend} from the index OHLCV.

    MAs are None when there is insufficient history (<200 rows for the slow MA),
    in which case the MA-based score caps are skipped (neutral).
    """
    if ohlcv_df is None or ohlcv_df.empty:
        return {"price": None, "ma50": None, "ma200": None, "trend": None}
    close = ohlcv_df["Close"]
    price = _f(close.iloc[-1])
    ma50 = _f(close.rolling(MA_FAST).mean().iloc[-1]) if len(close) >= MA_FAST else None
    ma200 = _f(close.rolling(MA_SLOW).mean().iloc[-1]) if len(close) >= MA_SLOW else None

    trend = "neutral"
    if None not in (price, ma50, ma200):
        if price > ma50 > ma200:
            trend = "bullish"
        elif price < ma50 < ma200:
            trend = "bearish"
    return {"price": price, "ma50": ma50, "ma200": ma200, "trend": trend}


def _score(trend: dict, dist_count: int, ftd: bool,
           vix: Optional[float], net_4pct: Optional[int]) -> tuple[float, dict]:
    """Blend inputs into a 0-100 score. Returns (score, components).

    Order: start at BASE_SCORE -> subtract penalties -> apply caps (min) ->
    FTD floor (max, last so it overrides crushing caps) -> clamp 0..100.
    Every delta/cap is recorded in ``components`` for the transparent "why".
    """
    price, ma50, ma200 = trend.get("price"), trend.get("ma50"), trend.get("ma200")
    score = BASE_SCORE
    components: dict = {"base": BASE_SCORE}

    # Penalties
    if dist_count:
        delta = -DIST_DAY_PENALTY * dist_count
        score += delta
        components["distribution_penalty"] = delta
    if net_4pct is not None and net_4pct < 0:
        score -= NET_4PCT_NEG_PENALTY
        components["net4pct_penalty"] = -NET_4PCT_NEG_PENALTY
    if vix is not None and vix > VIX_ELEVATED:
        score -= VIX_ELEVATED_PENALTY
        components["vix_elevated_penalty"] = -VIX_ELEVATED_PENALTY
    if vix is not None and vix > VIX_HIGH:
        score -= VIX_HIGH_PENALTY
        components["vix_high_penalty"] = -VIX_HIGH_PENALTY

    # Caps (ceilings)
    if dist_count >= 5:
        score = min(score, CAP_DISTRIBUTION_5PLUS)
        components["distribution_cap"] = CAP_DISTRIBUTION_5PLUS
    elif dist_count >= 3:
        score = min(score, CAP_DISTRIBUTION_3_4)
        components["distribution_cap"] = CAP_DISTRIBUTION_3_4
    if ma50 is not None and ma200 is not None and ma50 < ma200:
        score = min(score, CAP_DEATH_CROSS)
        components["death_cross_cap"] = CAP_DEATH_CROSS
    if price is not None and ma50 is not None and price < ma50:
        score = min(score, CAP_BELOW_50DMA)
        components["below_50dma_cap"] = CAP_BELOW_50DMA
    if price is not None and ma200 is not None and price < ma200:
        score = min(score, CAP_BELOW_200DMA)
        components["below_200dma_cap"] = CAP_BELOW_200DMA

    # FTD floor — applied last so a confirmed bounce overrides the caps above
    if ftd and price is not None and ma50 is not None and price <= ma50:
        if score < FTD_FLOOR:
            components["ftd_floor"] = FTD_FLOOR
        score = max(score, FTD_FLOOR)

    score = max(0.0, min(100.0, score))
    return round(score, 1), components


def _stance(score: float) -> str:
    for lower, label in STANCE_BANDS:
        if score >= lower:
            return label
    return STANCE_BANDS[-1][1]


def _latest_vix(db: Session, as_of_date: date) -> Optional[float]:
    row = (
        db.query(StockPrice)
        .filter(StockPrice.symbol == "^VIX", StockPrice.date <= as_of_date)
        .order_by(StockPrice.date.desc())
        .first()
    )
    return _f(row.close) if row is not None else None


def _latest_net_4pct(db: Session, market: str, as_of_date: date) -> Optional[int]:
    row = (
        db.query(MarketBreadth)
        .filter(MarketBreadth.market == market, MarketBreadth.date <= as_of_date)
        .order_by(MarketBreadth.date.desc())
        .first()
    )
    if row is None:
        return None
    return int((row.stocks_up_4pct or 0) - (row.stocks_down_4pct or 0))


def compute_exposure(market: str, as_of_date: date, db: Session) -> dict:
    """Compute the exposure dict for one market as of ``as_of_date``.

    Returns ``{"error": ...}`` (no row written) when index OHLCV is unavailable,
    so the pipeline guard treats it as a failure (mirrors the breadth task).
    """
    market = (market or "US").upper()

    # Benchmark service uses its own SessionLocal/Redis — do NOT pass the task's
    # db (it closes the session in a finally block).
    from .benchmark_cache_service import BenchmarkCacheService

    bundle = BenchmarkCacheService().get_benchmark_bundle(market=market, period="2y")
    if bundle is None or bundle.data is None or bundle.data.empty:
        return {"error": "no_benchmark_data", "market": market, "date": as_of_date.isoformat()}

    # Slice "as of" — tz-agnostic date mask (handles naive + tz-aware indexes).
    df = bundle.data[bundle.data.index.date <= as_of_date]
    if df.empty:
        return {"error": "no_benchmark_data", "market": market, "date": as_of_date.isoformat()}

    trend = compute_trend(df)
    dist = count_distribution_days(df)
    ftd, ftd_date = detect_follow_through_day(df)
    vix = _latest_vix(db, as_of_date) if market == "US" else None
    net_4pct = _latest_net_4pct(db, market, as_of_date)

    score, components = _score(trend, dist, ftd, vix, net_4pct)

    return {
        "market": market,
        "date": as_of_date,
        "exposure_score": score,
        "stance": _stance(score),
        "benchmark_price": trend["price"],
        "benchmark_ma50": trend["ma50"],
        "benchmark_ma200": trend["ma200"],
        "trend": trend["trend"],
        "distribution_day_count": dist,
        "follow_through_day": ftd,
        "follow_through_date": ftd_date,
        "vix": vix,
        "net_4pct": net_4pct,
        "components": components,
        "benchmark_symbol": bundle.benchmark_symbol,
    }


def compute_and_store(market: str, as_of_date: date, db: Session) -> dict:
    """Compute and upsert one MarketExposure row by (date, market).

    ``compute_exposure`` returns a dict whose keys are exactly MarketExposure
    columns (including market/date), so it is applied directly — there is no
    separate field mapping to keep in sync as the model grows.
    """
    result = compute_exposure(market, as_of_date, db)
    if result.get("error"):
        return result

    row = (
        db.query(MarketExposure)
        .filter(MarketExposure.date == as_of_date, MarketExposure.market == result["market"])
        .first()
    )
    if row is not None:
        for key, value in result.items():
            setattr(row, key, value)
    else:
        db.add(MarketExposure(**result))
    db.commit()
    return result


def build_exposure_payload(db: Session, market: str, history_days: int = 180) -> Optional[dict]:
    """Shared reader for the Daily Snapshot payloads (live + static).

    Returns the latest stored row's headline + a ``history`` list of
    {date, exposure_score, stance} over the trailing ``history_days``. None when
    no rows exist yet (the UI renders a muted placeholder).
    """
    market = (market or "US").upper()
    latest = (
        db.query(MarketExposure)
        .filter(MarketExposure.market == market)
        .order_by(MarketExposure.date.desc())
        .first()
    )
    if latest is None:
        return None

    start = latest.date - timedelta(days=history_days)
    rows = (
        db.query(MarketExposure)
        .filter(MarketExposure.market == market, MarketExposure.date >= start)
        .order_by(MarketExposure.date.asc())
        .all()
    )
    history = [
        {"date": r.date.isoformat(), "exposure_score": r.exposure_score, "stance": r.stance}
        for r in rows
    ]
    return {
        "market": market,
        "date": latest.date.isoformat(),
        "exposure_score": latest.exposure_score,
        "stance": latest.stance,
        "distribution_day_count": latest.distribution_day_count,
        "follow_through_day": latest.follow_through_day,
        "trend": latest.trend,
        "benchmark_price": latest.benchmark_price,
        "benchmark_ma50": latest.benchmark_ma50,
        "benchmark_ma200": latest.benchmark_ma200,
        "vix": latest.vix,
        "net_4pct": latest.net_4pct,
        "benchmark_symbol": latest.benchmark_symbol,
        "components": latest.components,
        "history": history,
    }
