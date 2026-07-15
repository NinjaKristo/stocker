"""Pydantic schemas for Backplay backtests and paper trading."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class StrategyInput(BaseModel):
    """A strategy to run: a built-in by id, or entry/exit scripts, plus guardrails."""

    kind: Literal["builtin", "script"] = "script"
    builtin_id: Optional[str] = None
    params: dict[str, Any] = Field(default_factory=dict)
    entry_script: Optional[str] = None
    exit_script: Optional[str] = None
    stop_loss_pct: Optional[float] = Field(None, gt=0, le=95)
    take_profit_pct: Optional[float] = Field(None, gt=0, le=1000)
    max_hold_days: Optional[int] = Field(None, ge=1, le=1000)


class BackplayRunRequest(BaseModel):
    mode: Literal["single", "scan_top10"]
    symbol: Optional[str] = None
    preset_key: Optional[str] = None
    top_n: int = Field(10, ge=1, le=25)
    market: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    strategy: StrategyInput
    starting_cash: float = Field(10_000.0, gt=0)


class ScriptValidationRequest(BaseModel):
    script: str


class StrategyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    strategy: StrategyInput


class PaperSetupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    source_kind: Literal["symbol", "preset"] = "symbol"
    symbol: Optional[str] = None
    preset_key: Optional[str] = None
    top_n: int = Field(10, ge=1, le=25)
    market: str = "US"
    strategy: StrategyInput
    position_size: float = Field(10_000.0, gt=0)
