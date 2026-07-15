import math

import pandas as pd

from app.api.v1._price_history import dataframe_to_points
from app.services.backplay.engine import StrategySpec, run_backtest
from app.services.ohlcv import finite_ohlcv_frame


def _frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Open": [10.0, math.nan, 12.0, 13.0],
            "High": [11.0, 12.0, math.inf, 14.0],
            "Low": [9.0, 10.0, 11.0, 12.0],
            "Close": [10.5, 11.5, 12.5, 13.5],
            "Volume": [1000, 1100, 1200, 1300],
        },
        index=pd.date_range("2026-01-01", periods=4, freq="D"),
    )


def test_finite_ohlcv_frame_drops_non_finite_rows() -> None:
    cleaned = finite_ohlcv_frame(_frame())

    assert list(cleaned.index) == [pd.Timestamp("2026-01-01"), pd.Timestamp("2026-01-04")]
    assert cleaned["Close"].tolist() == [10.5, 13.5]


def test_price_history_points_are_strict_json_numbers() -> None:
    points = dataframe_to_points(_frame(), days=3650)

    assert [point["date"] for point in points] == ["2026-01-01", "2026-01-04"]
    assert all(
        math.isfinite(float(value))
        for point in points
        for key, value in point.items()
        if key != "date"
    )


def test_backtest_summary_ignores_non_finite_bars() -> None:
    result = run_backtest(
        _frame(),
        StrategySpec(kind="builtin", builtin_id="buy_hold"),
        starting_cash=25_000,
    )

    assert result.summary["bars"] == 2
    assert result.summary["starting_cash"] == 25_000
    assert math.isfinite(result.summary["final_equity"])
