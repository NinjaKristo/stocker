"""Tests for the Backplay backtest engine mechanics.

Conventions under test (see docs/superpowers/specs/2026-07-05-backplay-design.md):
- signals are decided on bar close and filled at the NEXT bar's open
- stop loss / take profit are checked intrabar via low/high; stop wins ties
- long-only, one position at a time, all-in from starting cash
- open positions are closed at the last bar's close (end_of_data)
"""

import pandas as pd
import pytest

from app.services.backplay.engine import StrategySpec, run_backtest


def make_df(closes, opens=None, highs=None, lows=None):
    n = len(closes)
    index = pd.bdate_range("2024-01-02", periods=n)
    opens = opens if opens is not None else list(closes)
    highs = highs if highs is not None else [max(o, c) for o, c in zip(opens, closes)]
    lows = lows if lows is not None else [min(o, c) for o, c in zip(opens, closes)]
    return pd.DataFrame(
        {
            "Open": [float(v) for v in opens],
            "High": [float(v) for v in highs],
            "Low": [float(v) for v in lows],
            "Close": [float(v) for v in closes],
            "Volume": [1_000_000] * n,
        },
        index=index,
    )


def script_spec(entry, exit=None, **kwargs):
    return StrategySpec(kind="script", entry_script=entry, exit_script=exit, **kwargs)


class TestFills:
    def test_entry_fills_at_next_bar_open(self):
        df = make_df(
            closes=[10, 11, 12, 13, 14],
            opens=[10, 11.5, 12.5, 13.5, 14.5],
        )
        result = run_backtest(df, script_spec("close > 10"))
        assert len(result.trades) == 1
        trade = result.trades[0]
        assert trade.entry_price == 12.5
        assert trade.entry_date == df.index[2].date()

    def test_exit_rule_fills_at_next_open(self):
        df = make_df(
            closes=[1, 11, 12, 4, 4, 4],
            opens=[1, 11, 12, 4, 4.5, 4],
        )
        result = run_backtest(df, script_spec("close > 10", "close < 5"))
        trade = result.trades[0]
        assert trade.exit_price == 4.5
        assert trade.exit_date == df.index[4].date()
        assert trade.exit_reason == "exit_rule"

    def test_entry_signal_on_last_bar_cannot_fill(self):
        df = make_df(closes=[1, 11])
        result = run_backtest(df, script_spec("close > 10"))
        assert result.trades == []


class TestGuardrails:
    def test_stop_loss_exits_intrabar_at_stop_price(self):
        df = make_df(
            closes=[10, 11, 12.4, 13],
            opens=[10, 11, 12.5, 13],
            lows=[10, 11, 11.0, 13],
        )
        result = run_backtest(df, script_spec("close > 10", stop_loss_pct=4.0))
        trade = result.trades[0]
        assert trade.exit_reason == "stop_loss"
        assert trade.exit_price == pytest.approx(12.5 * 0.96)
        assert trade.exit_date == df.index[2].date()

    def test_gap_below_stop_fills_at_open(self):
        df = make_df(
            closes=[10, 11, 12.6, 11.4],
            opens=[10, 11, 12.5, 11.5],
            lows=[10, 11, 12.4, 11.0],
        )
        result = run_backtest(df, script_spec("close > 10", stop_loss_pct=4.0))
        trade = result.trades[0]
        assert trade.exit_reason == "stop_loss"
        assert trade.exit_price == 11.5  # gapped below the 12.0 stop
        assert trade.exit_date == df.index[3].date()

    def test_take_profit_exits_at_target(self):
        df = make_df(
            closes=[10, 11, 12.6, 13.6],
            opens=[10, 11, 12.5, 13.0],
            highs=[10, 11, 12.7, 14.0],
        )
        result = run_backtest(df, script_spec("close > 10", take_profit_pct=8.0))
        trade = result.trades[0]
        assert trade.exit_reason == "take_profit"
        assert trade.exit_price == pytest.approx(12.5 * 1.08)

    def test_stop_wins_over_target_on_same_bar(self):
        df = make_df(
            closes=[10, 11, 12.5, 12.5],
            opens=[10, 11, 12.5, 12.5],
            highs=[10, 11, 12.5, 13.6],
            lows=[10, 11, 12.5, 11.9],
        )
        result = run_backtest(
            df, script_spec("close > 10", stop_loss_pct=4.0, take_profit_pct=8.0)
        )
        assert result.trades[0].exit_reason == "stop_loss"

    def test_max_hold_days_exits_at_close(self):
        df = make_df(closes=[10, 11, 12, 13, 14, 15])
        result = run_backtest(df, script_spec("close > 10", max_hold_days=2))
        trade = result.trades[0]
        assert trade.exit_reason == "max_hold"
        # Filled at bar 2, held bars 2 and 3, exits at bar 3 close.
        assert trade.exit_date == df.index[3].date()
        assert trade.exit_price == 13.0


class TestLifecycle:
    def test_open_position_closes_at_end_of_data(self):
        df = make_df(closes=[10, 11, 12, 13])
        result = run_backtest(df, script_spec("close > 10"))
        trade = result.trades[0]
        assert trade.exit_reason == "end_of_data"
        assert trade.exit_price == 13.0

    def test_no_signals_means_no_trades(self):
        df = make_df(closes=[1, 2, 3])
        result = run_backtest(df, script_spec("close > 10"))
        assert result.trades == []
        assert result.summary["num_trades"] == 0
        assert result.summary["win_rate"] is None

    def test_two_trades_metrics(self):
        closes = [1, 11, 12, 4, 4, 11, 12, 13]
        df = make_df(closes=closes)
        result = run_backtest(df, script_spec("close > 10", "close < 5"))

        assert len(result.trades) == 2
        loss, win = result.trades
        assert loss.entry_price == 12.0 and loss.exit_price == 4.0
        assert win.entry_price == 12.0 and win.exit_price == 13.0

        summary = result.summary
        assert summary["num_trades"] == 2
        assert summary["win_rate"] == pytest.approx(0.5)
        # 10_000 * (4/12) * (13/12) = 3611.11 → -63.89%
        assert summary["total_return_pct"] == pytest.approx(-63.888, abs=0.01)
        # Buy & hold benchmark: first open 1 → last close 13 = +1200%
        assert summary["buy_hold_return_pct"] == pytest.approx(1200.0)

    def test_equity_curve_marks_to_market(self):
        df = make_df(closes=[10, 11, 12, 13])
        result = run_backtest(df, script_spec("close > 10"), starting_cash=10_000.0)
        assert len(result.equity_curve) == len(df)
        assert result.equity_curve[0][1] == 10_000.0
        # Entered at bar 2 open (12): last equity = 10000 * 13/12
        assert result.equity_curve[-1][1] == pytest.approx(10_000.0 * 13 / 12)


class TestBuiltins:
    def test_buy_hold_enters_first_open_exits_last_close(self):
        df = make_df(closes=[10, 12, 11, 20], opens=[8, 12, 11, 20])
        result = run_backtest(df, StrategySpec(kind="builtin", builtin_id="buy_hold"))
        assert len(result.trades) == 1
        trade = result.trades[0]
        assert trade.entry_price == 8.0
        assert trade.exit_price == 20.0
        assert result.summary["total_return_pct"] == pytest.approx(150.0)

    def test_breakout_builtin_produces_trade(self):
        closes = [10] * 10 + [12, 13, 14, 15, 16]
        df = make_df(closes=closes)
        spec = StrategySpec(kind="builtin", builtin_id="breakout", params={"entry_lookback": 5, "exit_lookback": 3})
        result = run_backtest(df, spec)
        assert len(result.trades) >= 1

    def test_unknown_builtin_raises(self):
        df = make_df(closes=[1, 2, 3])
        with pytest.raises(ValueError, match="(?i)unknown"):
            run_backtest(df, StrategySpec(kind="builtin", builtin_id="hodl"))
