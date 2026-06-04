"""Shared helpers for the stock route modules (``stocks`` and ``stocks_rs_line``).

Covers price-history windowing (``PERIOD_DAYS``, ``window_cutoff``,
``dataframe_to_points``) plus ``resolve_symbol_market``. Kept in one place so
these don't drift between the two route modules. (There is no canonical public
symbol→market resolver in the codebase — every call site does its own
``StockUniverse.market`` lookup — so this is the shared home for the route layer.)
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
from sqlalchemy.orm import Session

from ...models.stock_universe import StockUniverse

PERIOD_DAYS: dict[str, int] = {
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
}


def window_cutoff(index: pd.Index, days: int) -> pd.Timestamp:
    """Return the tz-aware ``now - days`` cutoff aligned to ``index``'s tz."""
    cutoff = pd.Timestamp(datetime.now() - timedelta(days=days))
    if getattr(index, "tz", None) is not None:
        cutoff = cutoff.tz_localize(index.tz)
    return cutoff


def resolve_symbol_market(db: Session, symbol: str) -> str | None:
    market = (
        db.query(StockUniverse.market)
        .filter(
            StockUniverse.active_filter(),
            StockUniverse.symbol == symbol.upper(),
        )
        .scalar()
    )
    normalized = str(market or "").strip().upper()
    return normalized or None


def dataframe_to_points(data: pd.DataFrame | None, days: int) -> list[dict]:
    """Filter an OHLCV DataFrame to the last ``days`` and convert to JSON dicts."""
    if data is None or len(data) == 0:
        return []

    filtered = data[data.index >= window_cutoff(data.index, days)]
    if len(filtered) == 0:
        return []

    df = filtered.reset_index()
    date_col = df.columns[0]
    df = df.rename(columns={date_col: "Date"})
    df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")

    return [
        {
            "date": row["Date"],
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
        }
        for _, row in df.iterrows()
    ]
