"""Paper Trader API — ongoing script-driven practice trades (tasks.md #7.4)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ...database import get_db
from ...models.backplay import PaperSetup, PaperTrade
from ...schemas.backplay import PaperSetupCreate
from ...services.backplay.paper import evaluate_active_setups, evaluate_setup
from .backplay import _compile_or_422

logger = logging.getLogger(__name__)
router = APIRouter()


def _setup_to_dict(setup: PaperSetup, stats: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {
        "id": setup.id,
        "name": setup.name,
        "status": setup.status,
        "source_kind": setup.source_kind,
        "symbol": setup.symbol,
        "preset_key": setup.preset_key,
        "top_n": setup.top_n,
        "market": setup.market,
        "strategy": setup.strategy_json,
        "position_size": setup.position_size,
        "created_at": setup.created_at.isoformat() if setup.created_at else None,
        "stopped_at": setup.stopped_at.isoformat() if setup.stopped_at else None,
        "last_evaluated_at": setup.last_evaluated_at.isoformat() if setup.last_evaluated_at else None,
    }
    if stats is not None:
        payload.update(stats)
    return payload


def _trade_to_dict(trade: PaperTrade) -> dict[str, Any]:
    return {
        "id": trade.id,
        "setup_id": trade.setup_id,
        "symbol": trade.symbol,
        "status": trade.status,
        "entry_date": trade.entry_date.isoformat() if trade.entry_date else None,
        "entry_price": trade.entry_price,
        "shares": trade.shares,
        "exit_date": trade.exit_date.isoformat() if trade.exit_date else None,
        "exit_price": trade.exit_price,
        "return_pct": trade.return_pct,
        "exit_reason": trade.exit_reason,
        "events": trade.events_json or [],
    }


def _get_setup_or_404(db: Session, setup_id: int) -> PaperSetup:
    setup = db.query(PaperSetup).filter(PaperSetup.id == setup_id).first()
    if setup is None:
        raise HTTPException(status_code=404, detail="Paper setup not found")
    return setup


@router.get("/setups")
async def list_setups(db: Session = Depends(get_db)):
    """All setups with per-setup trade stats for the table view."""
    setups = db.query(PaperSetup).order_by(PaperSetup.id.desc()).all()

    stat_rows = (
        db.query(
            PaperTrade.setup_id,
            PaperTrade.status,
            func.count(PaperTrade.id),
            func.avg(PaperTrade.return_pct),
            func.sum(case((PaperTrade.return_pct > 0, 1), else_=0)),
        )
        .group_by(PaperTrade.setup_id, PaperTrade.status)
        .all()
    )
    stats: dict[int, dict[str, Any]] = {}
    for setup_id, status, count, avg_return, wins in stat_rows:
        entry = stats.setdefault(
            setup_id,
            {"open_trades": 0, "closed_trades": 0, "avg_return_pct": None, "wins": 0},
        )
        if status == "open":
            entry["open_trades"] = count
        else:
            entry["closed_trades"] = count
            entry["avg_return_pct"] = round(avg_return, 4) if avg_return is not None else None
            entry["wins"] = int(wins or 0)

    return {
        "setups": [
            _setup_to_dict(
                setup,
                stats.get(
                    setup.id,
                    {"open_trades": 0, "closed_trades": 0, "avg_return_pct": None, "wins": 0},
                ),
            )
            for setup in setups
        ]
    }


@router.post("/setups")
async def create_setup(request: PaperSetupCreate, db: Session = Depends(get_db)):
    _compile_or_422(request.strategy)

    if request.source_kind == "symbol":
        if not request.symbol or not request.symbol.strip():
            raise HTTPException(status_code=422, detail="Pick a stock symbol to watch")
    elif not request.preset_key:
        raise HTTPException(status_code=422, detail="Pick a scan preset to watch")

    setup = PaperSetup(
        name=request.name,
        status="active",
        source_kind=request.source_kind,
        symbol=request.symbol.strip().upper() if request.symbol else None,
        preset_key=request.preset_key,
        top_n=request.top_n,
        market=(request.market or "US").upper(),
        strategy_json=request.strategy.model_dump(mode="json"),
        position_size=request.position_size,
    )
    db.add(setup)
    db.commit()
    db.refresh(setup)
    return _setup_to_dict(setup)


@router.post("/setups/{setup_id}/stop")
async def stop_setup(setup_id: int, db: Session = Depends(get_db)):
    setup = _get_setup_or_404(db, setup_id)
    setup.status = "stopped"
    setup.stopped_at = datetime.now(UTC)
    db.commit()
    db.refresh(setup)
    return _setup_to_dict(setup)


@router.post("/setups/{setup_id}/start")
async def start_setup(setup_id: int, db: Session = Depends(get_db)):
    setup = _get_setup_or_404(db, setup_id)
    setup.status = "active"
    setup.stopped_at = None
    db.commit()
    db.refresh(setup)
    return _setup_to_dict(setup)


@router.delete("/setups/{setup_id}")
async def delete_setup(setup_id: int, db: Session = Depends(get_db)):
    setup = _get_setup_or_404(db, setup_id)
    db.query(PaperTrade).filter(PaperTrade.setup_id == setup_id).delete()
    db.delete(setup)
    db.commit()
    return {"status": "deleted", "setup_id": setup_id}


@router.get("/trades")
async def list_trades(
    db: Session = Depends(get_db),
    setup_id: Optional[int] = None,
    status: Optional[str] = Query(None, pattern="^(open|closed)$"),
    limit: int = 100,
):
    if not isinstance(status, str):
        status = None
    limit = max(1, min(int(limit), 500))
    query = db.query(PaperTrade)
    if setup_id is not None:
        query = query.filter(PaperTrade.setup_id == setup_id)
    if status is not None:
        query = query.filter(PaperTrade.status == status)
    trades = query.order_by(PaperTrade.id.desc()).limit(limit).all()
    return {"trades": [_trade_to_dict(trade) for trade in trades]}


@router.post("/evaluate")
async def evaluate_now(
    db: Session = Depends(get_db),
    setup_id: Optional[int] = None,
):
    """Check rules against the latest cached bars right now ("Check now")."""
    if setup_id is not None:
        setup = _get_setup_or_404(db, setup_id)
        return evaluate_setup(db, setup)
    return evaluate_active_setups(db)
