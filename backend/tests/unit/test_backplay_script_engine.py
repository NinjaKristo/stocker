"""Tests for the Backplay strategy script engine (thinkScript-inspired DSL).

The engine compiles a small expression language into a callable that maps an
OHLCV DataFrame (price-cache column convention: Open/High/Low/Close/Volume)
to a boolean signal Series aligned to the frame's index.
"""

import numpy as np
import pandas as pd
import pytest

from app.services.backplay.script_engine import ScriptError, compile_script


def make_df(closes, volumes=None, highs=None, lows=None, opens=None):
    n = len(closes)
    closes = pd.Series(closes, dtype=float)
    df = pd.DataFrame(
        {
            "Open": opens if opens is not None else closes.values,
            "High": highs if highs is not None else closes.values,
            "Low": lows if lows is not None else closes.values,
            "Close": closes.values,
            "Volume": volumes if volumes is not None else [1_000_000] * n,
        },
        index=pd.bdate_range("2024-01-02", periods=n),
    )
    return df


class TestBasicExpressions:
    def test_close_greater_than_constant(self):
        df = make_df([99, 100, 101, 102])
        rule = compile_script("close > 100")
        result = rule.evaluate(df)
        assert list(result) == [False, False, True, True]

    def test_arithmetic_with_volume_multiplier(self):
        df = make_df([10, 10, 10], volumes=[100, 200, 400])
        rule = compile_script("volume > 1.5 * 150")
        assert list(rule.evaluate(df)) == [False, False, True]

    def test_keywords_and_functions_are_case_insensitive(self):
        df = make_df([1, 2, 3])
        rule = compile_script("CLOSE >= 2 AND Close <= 3")
        assert list(rule.evaluate(df)) == [False, True, True]


class TestFunctions:
    def test_sma_comparison(self):
        # SMA(close, 2) = [nan, 1.5, 2.5, 3.5]; close > sma -> warmup bars are False
        df = make_df([1, 2, 3, 4])
        rule = compile_script("close > SMA(close, 2)")
        assert list(rule.evaluate(df)) == [False, True, True, True]

    def test_highest_breakout_expression(self):
        # Highest of prior bars: breakout only on the bar exceeding the prior 3-bar max.
        df = make_df([10, 11, 12, 11, 13])
        rule = compile_script("close > Highest(close, 3)")
        # Highest uses the *previous* n bars (shifted), so a new high fires.
        assert list(rule.evaluate(df)) == [False, True, True, False, True]

    def test_rsi_bounds(self):
        rng = np.random.default_rng(7)
        df = make_df(100 + rng.normal(0, 1, 60).cumsum())
        rule = compile_script("RSI(14) >= 0 and RSI(14) <= 100")
        result = rule.evaluate(df)
        # After warmup every RSI value is inside [0, 100].
        assert result.iloc[20:].all()

    def test_lowest_and_atr_exist(self):
        df = make_df([5, 4, 3, 2, 1])
        assert bool(list(compile_script("close < Lowest(close, 2)").evaluate(df))[-1]) is True
        # ATR over identical H/L/C bars is ~0 after warmup, never negative.
        atr_rule = compile_script("ATR(3) >= 0")
        assert atr_rule.evaluate(df).iloc[-1]


class TestCrosses:
    def test_crosses_above_fires_only_on_crossing_bar(self):
        df = make_df([1, 2, 3, 10, 11, 12])
        # SMA(close,3): nan nan 2 5 8 11 — close crosses above on the bar where
        # it moves from <= to >.
        rule = compile_script("close crosses above SMA(close, 3)")
        result = list(rule.evaluate(df))
        assert result.count(True) >= 1
        # Never two consecutive Trues for a monotonic series crossing once.
        assert not any(a and b for a, b in zip(result, result[1:]))

    def test_crosses_below(self):
        df = make_df([10, 10, 10, 1, 1, 1])
        rule = compile_script("close crosses below SMA(close, 2)")
        result = list(rule.evaluate(df))
        assert bool(result[3]) is True
        assert result.count(True) == 1


class TestBooleanLogic:
    def test_and_or_not(self):
        df = make_df([1, 5, 10], volumes=[10, 10, 1000])
        rule = compile_script("(close > 2 and volume > 100) or not close >= 1")
        assert list(rule.evaluate(df)) == [False, False, True]


class TestErrors:
    def test_unknown_identifier_raises_script_error(self):
        with pytest.raises(ScriptError, match="(?i)unknown"):
            compile_script("closs > 100")

    def test_syntax_error_raises_script_error(self):
        with pytest.raises(ScriptError):
            compile_script("close > > 100")

    def test_unknown_function_raises_script_error(self):
        with pytest.raises(ScriptError, match="(?i)unknown"):
            compile_script("WMA(close, 5) > 1")

    def test_empty_script_raises(self):
        with pytest.raises(ScriptError):
            compile_script("   ")

    def test_non_boolean_result_raises(self):
        with pytest.raises(ScriptError, match="(?i)true/false"):
            compile_script("close + 1")
