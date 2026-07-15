"""Backplay backtest engine.

Simulates one strategy on one symbol's daily bars:

- signals are decided on bar close and filled at the NEXT bar's open
  (no look-ahead: you can only act on what you knew yesterday)
- stop loss / take profit are checked intrabar via low/high, starting on the
  fill bar itself; when both could fire on the same bar the stop wins
- long-only, one position at a time, all-in from starting cash
- an open position is closed at the last bar's close (``end_of_data``)

Built-in strategies compile down to the same script language as user scripts,
so both paths exercise identical mechanics.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

import pandas as pd

from .script_engine import CompiledScript, ScriptError, compile_script

__all__ = ["StrategySpec", "Trade", "BacktestResult", "run_backtest", "BUILTIN_STRATEGIES"]


# ---------------------------------------------------------------------------
# Strategy specification
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class StrategySpec:
    """A strategy to simulate: a built-in by id, or entry/exit scripts."""

    kind: str = "script"  # script | builtin
    builtin_id: str | None = None
    params: dict[str, Any] = field(default_factory=dict)
    entry_script: str | None = None
    exit_script: str | None = None
    stop_loss_pct: float | None = None
    take_profit_pct: float | None = None
    max_hold_days: int | None = None


# Built-in strategies, described for beginners and compiled to scripts.
BUILTIN_STRATEGIES: dict[str, dict[str, Any]] = {
    "breakout": {
        "name": "Breakout",
        "description": (
            "Buy when the price closes above its highest close of the last "
            "{entry_lookback} days (it just broke out). Sell when it closes below "
            "its lowest close of the last {exit_lookback} days (the move failed)."
        ),
        "defaults": {"entry_lookback": 20, "exit_lookback": 10},
        "entry": "close > Highest(close, {entry_lookback})",
        "exit": "close < Lowest(close, {exit_lookback})",
    },
    "ma_cross": {
        "name": "Moving-Average Cross",
        "description": (
            "Buy when the {fast}-day average price rises above the {slow}-day average "
            "(short-term strength). Sell when it falls back below."
        ),
        "defaults": {"fast": 10, "slow": 50},
        "entry": "SMA(close, {fast}) crosses above SMA(close, {slow})",
        "exit": "SMA(close, {fast}) crosses below SMA(close, {slow})",
    },
    "buy_hold": {
        "name": "Buy & Hold",
        "description": "Buy on the first day and hold to the end — the benchmark to beat.",
        "defaults": {},
        "entry": None,
        "exit": None,
    },
}


def _resolve_scripts(spec: StrategySpec) -> tuple[CompiledScript | None, CompiledScript | None, bool]:
    """Return (entry, exit, immediate_entry) for a spec."""
    if spec.kind == "builtin":
        definition = BUILTIN_STRATEGIES.get(spec.builtin_id or "")
        if definition is None:
            known = ", ".join(sorted(BUILTIN_STRATEGIES))
            raise ValueError(f"Unknown built-in strategy '{spec.builtin_id}' (available: {known})")
        if spec.builtin_id == "buy_hold":
            return None, None, True
        params = {**definition["defaults"], **(spec.params or {})}
        entry = compile_script(definition["entry"].format(**params))
        exit_ = compile_script(definition["exit"].format(**params)) if definition["exit"] else None
        return entry, exit_, False

    if spec.kind == "script":
        if not spec.entry_script or not spec.entry_script.strip():
            raise ScriptError("A script strategy needs an entry rule")
        entry = compile_script(spec.entry_script)
        exit_ = compile_script(spec.exit_script) if spec.exit_script and spec.exit_script.strip() else None
        return entry, exit_, False

    raise ValueError(f"Unknown strategy kind '{spec.kind}'")


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------


@dataclass
class Trade:
    entry_date: date
    entry_price: float
    exit_date: date | None
    exit_price: float | None
    shares: float
    return_pct: float | None
    exit_reason: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "entry_date": self.entry_date.isoformat(),
            "entry_price": round(self.entry_price, 4),
            "exit_date": self.exit_date.isoformat() if self.exit_date else None,
            "exit_price": round(self.exit_price, 4) if self.exit_price is not None else None,
            "shares": round(self.shares, 6),
            "return_pct": round(self.return_pct, 4) if self.return_pct is not None else None,
            "exit_reason": self.exit_reason,
        }


@dataclass
class BacktestResult:
    trades: list[Trade]
    equity_curve: list[tuple[date, float]]
    summary: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "trades": [trade.to_dict() for trade in self.trades],
            "equity_curve": [
                {"date": point_date.isoformat(), "value": round(value, 2)}
                for point_date, value in self.equity_curve
            ],
            "summary": self.summary,
        }


def _build_summary(
    trades: list[Trade],
    equity_curve: list[tuple[date, float]],
    starting_cash: float,
    df: pd.DataFrame,
) -> dict[str, Any]:
    closed = [t for t in trades if t.return_pct is not None]
    wins = [t.return_pct for t in closed if t.return_pct > 0]
    losses = [t.return_pct for t in closed if t.return_pct <= 0]

    final_equity = equity_curve[-1][1] if equity_curve else starting_cash
    first_open = float(df["Open"].iloc[0]) if len(df) else None
    last_close = float(df["Close"].iloc[-1]) if len(df) else None

    max_drawdown_pct = 0.0
    peak = float("-inf")
    for _, value in equity_curve:
        peak = max(peak, value)
        if peak > 0:
            max_drawdown_pct = min(max_drawdown_pct, (value / peak - 1.0) * 100.0)

    def _round(value: float | None, digits: int = 4) -> float | None:
        return round(value, digits) if value is not None else None

    return {
        "num_trades": len(closed),
        "win_rate": _round(len(wins) / len(closed)) if closed else None,
        "total_return_pct": _round((final_equity / starting_cash - 1.0) * 100.0),
        "buy_hold_return_pct": (
            _round((last_close / first_open - 1.0) * 100.0)
            if first_open and last_close and first_open > 0
            else None
        ),
        "avg_win_pct": _round(sum(wins) / len(wins)) if wins else None,
        "avg_loss_pct": _round(sum(losses) / len(losses)) if losses else None,
        "max_drawdown_pct": _round(max_drawdown_pct),
        "final_equity": _round(final_equity, 2),
        "starting_cash": starting_cash,
        "start_date": df.index[0].date().isoformat() if len(df) else None,
        "end_date": df.index[-1].date().isoformat() if len(df) else None,
        "bars": int(len(df)),
    }


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


def run_backtest(
    df: pd.DataFrame,
    spec: StrategySpec,
    starting_cash: float = 10_000.0,
) -> BacktestResult:
    """Simulate ``spec`` over daily OHLCV bars (columns Open/High/Low/Close/Volume)."""
    entry_rule, exit_rule, immediate_entry = _resolve_scripts(spec)

    if df is None or df.empty:
        return BacktestResult(trades=[], equity_curve=[], summary=_build_summary([], [], starting_cash, pd.DataFrame()))

    entry_signal = entry_rule.evaluate(df) if entry_rule is not None else None
    exit_signal = exit_rule.evaluate(df) if exit_rule is not None else None

    opens = df["Open"].astype(float).values
    highs = df["High"].astype(float).values
    lows = df["Low"].astype(float).values
    closes = df["Close"].astype(float).values
    dates = [ts.date() for ts in df.index]

    cash = float(starting_cash)
    trades: list[Trade] = []
    equity_curve: list[tuple[date, float]] = []

    position: Trade | None = None
    entry_index: int | None = None
    pending_entry = immediate_entry
    pending_exit = False

    def close_position(i: int, price: float, reason: str) -> None:
        nonlocal cash, position, entry_index, pending_exit
        assert position is not None
        position.exit_date = dates[i]
        position.exit_price = price
        position.return_pct = (price / position.entry_price - 1.0) * 100.0
        position.exit_reason = reason
        cash = position.shares * price
        trades.append(position)
        position = None
        entry_index = None
        pending_exit = False

    for i in range(len(df)):
        # 1) fills at the open
        if position is None and pending_entry:
            pending_entry = False
            price = opens[i]
            if price > 0:
                position = Trade(
                    entry_date=dates[i],
                    entry_price=price,
                    exit_date=None,
                    exit_price=None,
                    shares=cash / price,
                    return_pct=None,
                    exit_reason=None,
                )
                entry_index = i
        elif position is not None and pending_exit:
            close_position(i, opens[i], "exit_rule")

        # 2) intrabar guardrails (checked on the fill bar too)
        if position is not None:
            stop_price = (
                position.entry_price * (1.0 - spec.stop_loss_pct / 100.0)
                if spec.stop_loss_pct is not None
                else None
            )
            target_price = (
                position.entry_price * (1.0 + spec.take_profit_pct / 100.0)
                if spec.take_profit_pct is not None
                else None
            )
            if stop_price is not None and lows[i] <= stop_price:
                fill = opens[i] if opens[i] < stop_price else stop_price
                close_position(i, fill, "stop_loss")
            elif target_price is not None and highs[i] >= target_price:
                fill = opens[i] if opens[i] > target_price else target_price
                close_position(i, fill, "take_profit")

        # 3) close-of-bar decisions
        if position is not None:
            bars_held = i - entry_index + 1
            if spec.max_hold_days is not None and bars_held >= spec.max_hold_days:
                close_position(i, closes[i], "max_hold")
            elif exit_signal is not None and bool(exit_signal.iloc[i]):
                pending_exit = True

        if position is None and not pending_entry and entry_signal is not None and bool(entry_signal.iloc[i]):
            pending_entry = True

        # 4) mark to market
        equity_curve.append((dates[i], position.shares * closes[i] if position is not None else cash))

    if position is not None:
        close_position(len(df) - 1, closes[-1], "end_of_data")
        equity_curve[-1] = (dates[-1], cash)

    return BacktestResult(
        trades=trades,
        equity_curve=equity_curve,
        summary=_build_summary(trades, equity_curve, starting_cash, df),
    )
