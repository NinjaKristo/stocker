"""Shared validation helpers for cached OHLCV price frames."""

from __future__ import annotations

import numpy as np
import pandas as pd

OHLCV_COLUMNS: tuple[str, ...] = ("Open", "High", "Low", "Close", "Volume")


def finite_ohlcv_frame(data: pd.DataFrame | None) -> pd.DataFrame:
    """Return a copy containing only rows with finite numeric OHLCV values."""
    if data is None or data.empty:
        return pd.DataFrame() if data is None else data.copy()

    missing = [column for column in OHLCV_COLUMNS if column not in data.columns]
    if missing:
        return data.iloc[0:0].copy()

    numeric = data.loc[:, OHLCV_COLUMNS].apply(pd.to_numeric, errors="coerce")
    valid = np.isfinite(numeric.to_numpy(dtype=float)).all(axis=1)
    cleaned = data.loc[valid].copy()
    cleaned.loc[:, OHLCV_COLUMNS] = numeric.loc[valid]
    return cleaned
