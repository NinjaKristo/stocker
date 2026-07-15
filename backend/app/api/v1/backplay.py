"""Backplay API — run backtests, browse history, presets and saved strategies.

Backtests run synchronously in the request: the engine is vectorized pandas
over cached daily bars (cache-only, no external fetches), so even the
scan-top-10 mode finishes in well under a second per symbol.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...database import get_db
from ...models.backplay import BackplayRun, BackplayStrategy
from ...schemas.backplay import (
    BackplayRunRequest,
    ScriptValidationRequest,
    StrategyCreate,
    StrategyInput,
)
from ...services.backplay.engine import BUILTIN_STRATEGIES, StrategySpec, run_backtest
from ...services.backplay.script_engine import ScriptError, compile_script
from ...services.backplay.selection import list_presets, load_latest_serialized_rows, select_top_symbols
from ...services.backplay.similarity import generate_peer_screens

logger = logging.getLogger(__name__)
router = APIRouter()

PRICE_PERIOD = "5y"


def _load_price_frame(symbol: str, market: str | None = None) -> pd.DataFrame | None:
    """Cache-only daily bars for a symbol (monkeypatched in tests)."""
    from app.wiring.bootstrap import get_price_cache

    return get_price_cache().get_cached_only(symbol.upper(), period=PRICE_PERIOD)


def _to_spec(strategy: StrategyInput) -> StrategySpec:
    return StrategySpec(
        kind=strategy.kind,
        builtin_id=strategy.builtin_id,
        params=strategy.params or {},
        entry_script=strategy.entry_script,
        exit_script=strategy.exit_script,
        stop_loss_pct=strategy.stop_loss_pct,
        take_profit_pct=strategy.take_profit_pct,
        max_hold_days=strategy.max_hold_days,
    )


def _compile_or_422(strategy: StrategyInput) -> StrategySpec:
    """Validate the strategy up front so script errors come back as 422s."""
    spec = _to_spec(strategy)
    try:
        if spec.kind == "script":
            if not (spec.entry_script or "").strip():
                raise ScriptError("A script strategy needs an entry rule")
            compile_script(spec.entry_script)
            if spec.exit_script and spec.exit_script.strip():
                compile_script(spec.exit_script)
        elif spec.kind == "builtin":
            if spec.builtin_id not in BUILTIN_STRATEGIES:
                known = ", ".join(sorted(BUILTIN_STRATEGIES))
                raise HTTPException(
                    status_code=422,
                    detail=f"Unknown built-in strategy '{spec.builtin_id}' (available: {known})",
                )
    except ScriptError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return spec


def _slice_dates(df: pd.DataFrame, request: BackplayRunRequest) -> pd.DataFrame:
    if request.start_date is not None:
        df = df.loc[df.index >= pd.Timestamp(request.start_date)]
    if request.end_date is not None:
        df = df.loc[df.index <= pd.Timestamp(request.end_date)]
    return df


def _backtest_symbol(
    symbol: str,
    request: BackplayRunRequest,
    spec: StrategySpec,
) -> dict[str, Any] | None:
    df = _load_price_frame(symbol, market=request.market)
    if df is None or df.empty:
        return None
    df = _slice_dates(df, request)
    if df.empty:
        return None
    return run_backtest(df, spec, starting_cash=request.starting_cash).to_dict()


def _run_to_summary_dict(run: BackplayRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "mode": run.mode,
        "status": run.status,
        "symbol": run.symbol,
        "preset_key": run.preset_key,
        "preset_name": run.preset_name,
        "start_date": run.start_date.isoformat() if run.start_date else None,
        "end_date": run.end_date.isoformat() if run.end_date else None,
        "strategy": run.strategy_json,
        "error": run.error,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "headline": (run.results_json or {}).get("summary") if run.mode == "single" else (run.results_json or {}).get("combined"),
    }


@router.post("/run")
async def run_backplay(
    request: BackplayRunRequest,
    db: Session = Depends(get_db),
):
    """Run a backtest now (single symbol or scan-preset top N) and persist it."""
    spec = _compile_or_422(request.strategy)

    if request.mode == "single":
        if not request.symbol or not request.symbol.strip():
            raise HTTPException(status_code=422, detail="Pick a stock symbol to test")
        symbol = request.symbol.strip().upper()
        results = _backtest_symbol(symbol, request, spec)
        if results is None:
            raise HTTPException(
                status_code=404,
                detail=f"No cached price history for {symbol} in that date range",
            )
        preset_name = None
    else:  # scan_top10
        if not request.preset_key:
            raise HTTPException(status_code=422, detail="Pick a scan preset to select stocks with")
        try:
            selection = select_top_symbols(
                db, request.preset_key, top_n=request.top_n, market=request.market
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        preset_name = selection["preset_name"]

        per_symbol: list[dict[str, Any]] = []
        for pick in selection["picks"]:
            symbol = pick["symbol"]
            symbol_results = _backtest_symbol(symbol, request, spec)
            per_symbol.append(
                {
                    "symbol": symbol,
                    "company_name": pick.get("company_name"),
                    "composite_score": pick.get("composite_score"),
                    "skipped": symbol_results is None,
                    "summary": symbol_results["summary"] if symbol_results else None,
                    "trades": symbol_results["trades"] if symbol_results else [],
                    "equity_curve": symbol_results["equity_curve"] if symbol_results else [],
                }
            )

        tested = [entry for entry in per_symbol if not entry["skipped"]]
        returns = [entry["summary"]["total_return_pct"] for entry in tested if entry["summary"]]
        win_rates = [
            entry["summary"]["win_rate"]
            for entry in tested
            if entry["summary"] and entry["summary"]["win_rate"] is not None
        ]
        results = {
            "selection": selection,
            "per_symbol": per_symbol,
            "combined": {
                "symbols_tested": len(tested),
                "symbols_skipped": len(per_symbol) - len(tested),
                "avg_return_pct": round(sum(returns) / len(returns), 4) if returns else None,
                "positive_symbols": sum(1 for value in returns if value > 0),
                "avg_win_rate": round(sum(win_rates) / len(win_rates), 4) if win_rates else None,
            },
        }
        symbol = None

    run = BackplayRun(
        mode=request.mode,
        status="completed",
        symbol=symbol,
        preset_key=request.preset_key,
        preset_name=preset_name,
        start_date=request.start_date,
        end_date=request.end_date,
        strategy_json=request.strategy.model_dump(mode="json"),
        results_json=results,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    return {
        "id": run.id,
        "mode": run.mode,
        "status": run.status,
        "symbol": run.symbol,
        "preset_key": run.preset_key,
        "preset_name": run.preset_name,
        "strategy": run.strategy_json,
        "results": results,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


@router.get("/runs")
async def list_runs(
    db: Session = Depends(get_db),
    limit: int = Query(25, ge=1, le=100),
):
    """Past backtests, newest first (light rows — fetch one for full results)."""
    runs = db.query(BackplayRun).order_by(BackplayRun.id.desc()).limit(limit).all()
    return {"runs": [_run_to_summary_dict(run) for run in runs]}


@router.get("/runs/{run_id}")
async def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(BackplayRun).filter(BackplayRun.id == run_id).first()
    if run is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    payload = _run_to_summary_dict(run)
    payload["results"] = run.results_json
    return payload


@router.get("/presets")
async def get_presets(db: Session = Depends(get_db)):
    """Merged preset catalog: built-in screens plus the user's saved presets."""
    return {"presets": list_presets(db)}


@router.get("/similar/{symbol}")
async def get_similar_stocks(
    symbol: str,
    db: Session = Depends(get_db),
    limit: int = Query(5, ge=1, le=10),
    market: Optional[str] = None,
):
    """Generate explainable peer screens from the latest published scan."""
    try:
        run_info, rows = load_latest_serialized_rows(db, market=market)
        result = generate_peer_screens(rows, symbol, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {**result, "feature_run": run_info}


@router.get("/strategies/builtins")
async def get_builtin_strategies():
    """Built-in strategy catalog with plain-language descriptions and defaults."""
    return {
        "builtins": [
            {
                "id": builtin_id,
                "name": definition["name"],
                "description": definition["description"].format(**definition["defaults"]),
                "defaults": definition["defaults"],
            }
            for builtin_id, definition in BUILTIN_STRATEGIES.items()
        ]
    }


@router.post("/validate-script")
async def validate_script(request: ScriptValidationRequest):
    """Live script feedback for the editor: {valid, error}."""
    try:
        compile_script(request.script)
        return {"valid": True, "error": None}
    except ScriptError as exc:
        return {"valid": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Saved strategies
# ---------------------------------------------------------------------------


def _strategy_to_dict(row: BackplayStrategy) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "strategy": {
            "kind": row.kind,
            "builtin_id": row.builtin_id,
            "params": row.params or {},
            "entry_script": row.entry_script,
            "exit_script": row.exit_script,
            "stop_loss_pct": row.stop_loss_pct,
            "take_profit_pct": row.take_profit_pct,
            "max_hold_days": row.max_hold_days,
        },
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/strategies")
async def list_strategies(db: Session = Depends(get_db)):
    rows = db.query(BackplayStrategy).order_by(BackplayStrategy.name).all()
    return {"strategies": [_strategy_to_dict(row) for row in rows]}


@router.post("/strategies")
async def create_strategy(request: StrategyCreate, db: Session = Depends(get_db)):
    _compile_or_422(request.strategy)
    existing = db.query(BackplayStrategy).filter(BackplayStrategy.name == request.name).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="A strategy with this name already exists")

    row = BackplayStrategy(
        name=request.name,
        description=request.description,
        kind=request.strategy.kind,
        builtin_id=request.strategy.builtin_id,
        params=request.strategy.params or {},
        entry_script=request.strategy.entry_script,
        exit_script=request.strategy.exit_script,
        stop_loss_pct=request.strategy.stop_loss_pct,
        take_profit_pct=request.strategy.take_profit_pct,
        max_hold_days=request.strategy.max_hold_days,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _strategy_to_dict(row)


@router.delete("/strategies/{strategy_id}")
async def delete_strategy(strategy_id: int, db: Session = Depends(get_db)):
    row = db.query(BackplayStrategy).filter(BackplayStrategy.id == strategy_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted", "strategy_id": strategy_id}
