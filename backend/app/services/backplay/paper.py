"""Paper-trading evaluation: run saved rules against the latest cached bars.

Runs after the market close (Celery beat) or on demand ("Check now"). Fills
happen at the close of the signal day — evaluation only sees completed bars.
Evaluation is catch-up safe: if days were missed, the bars since the last
check are replayed in order and the first exit that *would* have fired is
honored at that bar's close.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any, Callable

import pandas as pd
from sqlalchemy.orm import Session

from app.models.backplay import PaperSetup, PaperTrade

from .engine import StrategySpec, _resolve_scripts
from .selection import select_top_symbols

logger = logging.getLogger(__name__)

PRICE_PERIOD = "2y"

PriceLoader = Callable[..., "pd.DataFrame | None"]


def _default_price_loader(symbol: str, market: str | None = None) -> pd.DataFrame | None:
    from app.wiring.bootstrap import get_price_cache

    return get_price_cache().get_cached_only(symbol.upper(), period=PRICE_PERIOD)


def _spec_from_json(strategy_json: dict[str, Any]) -> StrategySpec:
    return StrategySpec(
        kind=strategy_json.get("kind", "script"),
        builtin_id=strategy_json.get("builtin_id"),
        params=strategy_json.get("params") or {},
        entry_script=strategy_json.get("entry_script"),
        exit_script=strategy_json.get("exit_script"),
        stop_loss_pct=strategy_json.get("stop_loss_pct"),
        take_profit_pct=strategy_json.get("take_profit_pct"),
        max_hold_days=strategy_json.get("max_hold_days"),
    )


def _append_event(trade: PaperTrade, kind: str, detail: str, at: str) -> None:
    events = list(trade.events_json or [])
    events.append({"at": at, "kind": kind, "detail": detail})
    trade.events_json = events


def _close_trade(trade: PaperTrade, when, price: float, reason: str) -> None:
    trade.status = "closed"
    trade.exit_date = when
    trade.exit_price = float(price)
    trade.exit_reason = reason
    if trade.entry_price:
        trade.return_pct = (float(price) / trade.entry_price - 1.0) * 100.0
    _append_event(trade, "closed", f"{reason} at {price:.2f}", when.isoformat())


def _manage_open_trade(trade: PaperTrade, df: pd.DataFrame, spec: StrategySpec, exit_signal) -> bool:
    """Replay bars after entry; close on the first exit that fires. True if closed."""
    dates = [ts.date() for ts in df.index]
    try:
        entry_position = dates.index(trade.entry_date)
    except ValueError:
        entry_position = next((i for i, d in enumerate(dates) if d >= trade.entry_date), None)
        if entry_position is None:
            return False

    stop_price = (
        trade.entry_price * (1.0 - spec.stop_loss_pct / 100.0)
        if spec.stop_loss_pct is not None and trade.entry_price
        else None
    )
    target_price = (
        trade.entry_price * (1.0 + spec.take_profit_pct / 100.0)
        if spec.take_profit_pct is not None and trade.entry_price
        else None
    )

    for i in range(entry_position + 1, len(df)):
        bar_date = dates[i]
        open_ = float(df["Open"].iloc[i])
        high = float(df["High"].iloc[i])
        low = float(df["Low"].iloc[i])
        close = float(df["Close"].iloc[i])

        if stop_price is not None and low <= stop_price:
            _close_trade(trade, bar_date, open_ if open_ < stop_price else stop_price, "stop_loss")
            return True
        if target_price is not None and high >= target_price:
            _close_trade(trade, bar_date, open_ if open_ > target_price else target_price, "take_profit")
            return True
        bars_held = i - entry_position + 1
        if spec.max_hold_days is not None and bars_held >= spec.max_hold_days:
            _close_trade(trade, bar_date, close, "max_hold")
            return True
        if exit_signal is not None and bool(exit_signal.iloc[i]):
            _close_trade(trade, bar_date, close, "exit_rule")
            return True

    return False


def evaluate_setup(
    db: Session,
    setup: PaperSetup,
    *,
    price_loader: PriceLoader | None = None,
) -> dict[str, Any]:
    """Evaluate one setup: manage open trades, then look for new entries."""
    loader = price_loader or _default_price_loader
    spec = _spec_from_json(setup.strategy_json or {})
    entry_rule, exit_rule, immediate_entry = _resolve_scripts(spec)

    opened = 0
    closed = 0

    # Candidates to watch for entries.
    if setup.source_kind == "symbol":
        candidates = [setup.symbol.upper()] if setup.symbol else []
    else:
        try:
            selection = select_top_symbols(
                db, setup.preset_key, top_n=setup.top_n or 10, market=setup.market
            )
            candidates = [pick["symbol"] for pick in selection["picks"] if pick.get("symbol")]
        except ValueError as exc:
            logger.warning("Paper setup %s: preset selection failed: %s", setup.id, exc)
            candidates = []

    # 1) manage open trades (their symbol may have dropped out of the scan —
    #    open positions are always managed).
    open_trades = (
        db.query(PaperTrade)
        .filter(PaperTrade.setup_id == setup.id, PaperTrade.status == "open")
        .all()
    )
    frames: dict[str, pd.DataFrame | None] = {}

    def frame_for(symbol: str) -> pd.DataFrame | None:
        if symbol not in frames:
            frames[symbol] = loader(symbol, market=setup.market)
        return frames[symbol]

    for trade in open_trades:
        df = frame_for(trade.symbol)
        if df is None or df.empty:
            continue
        exit_signal = exit_rule.evaluate(df) if exit_rule is not None else None
        if _manage_open_trade(trade, df, spec, exit_signal):
            closed += 1

    # 2) new entries on the latest bar
    open_symbols = {
        trade.symbol
        for trade in db.query(PaperTrade)
        .filter(PaperTrade.setup_id == setup.id, PaperTrade.status == "open")
        .all()
    }
    for symbol in candidates:
        if symbol in open_symbols:
            continue
        df = frame_for(symbol)
        if df is None or df.empty:
            continue
        latest_date = df.index[-1].date()
        # Skip if a trade for this symbol was already opened today, or closed
        # today — no instant re-entry on the same bar a stop just fired.
        touched_today = (
            db.query(PaperTrade)
            .filter(
                PaperTrade.setup_id == setup.id,
                PaperTrade.symbol == symbol,
                (PaperTrade.entry_date == latest_date) | (PaperTrade.exit_date == latest_date),
            )
            .count()
            > 0
        )
        if touched_today:
            continue

        signal = True if immediate_entry else (
            bool(entry_rule.evaluate(df).iloc[-1]) if entry_rule is not None else False
        )
        if not signal:
            continue

        price = float(df["Close"].iloc[-1])
        if price <= 0:
            continue
        trade = PaperTrade(
            setup_id=setup.id,
            symbol=symbol,
            status="open",
            entry_date=latest_date,
            entry_price=price,
            shares=(setup.position_size or 10_000.0) / price,
            events_json=[],
        )
        _append_event(trade, "opened", f"entry rule fired at {price:.2f}", latest_date.isoformat())
        db.add(trade)
        open_symbols.add(symbol)
        opened += 1

    setup.last_evaluated_at = datetime.now(UTC)
    db.commit()

    return {"setup_id": setup.id, "opened": opened, "closed": closed, "watched": len(candidates)}


def evaluate_active_setups(
    db: Session,
    *,
    price_loader: PriceLoader | None = None,
    market: str | None = None,
) -> dict[str, Any]:
    """Evaluate every active setup (optionally one market). Used by beat + API."""
    query = db.query(PaperSetup).filter(PaperSetup.status == "active")
    if market:
        query = query.filter(PaperSetup.market == market.upper())
    setups = query.all()

    opened = 0
    closed = 0
    for setup in setups:
        try:
            result = evaluate_setup(db, setup, price_loader=price_loader)
            opened += result["opened"]
            closed += result["closed"]
        except Exception:
            logger.exception("Paper setup %s evaluation failed", setup.id)

    return {"setups_evaluated": len(setups), "opened": opened, "closed": closed}
