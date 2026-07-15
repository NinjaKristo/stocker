"""Backplay backtests and paper-trading models."""
from sqlalchemy import (
    JSON,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.sql import func

from ..database import Base


class BackplayStrategy(Base):
    """A saved trading rule: either a parameterized built-in or entry/exit scripts."""

    __tablename__ = "backplay_strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    kind = Column(String(16), nullable=False, default="script")  # builtin | script
    builtin_id = Column(String(32), nullable=True)
    params = Column(JSON, nullable=True)
    entry_script = Column(Text, nullable=True)
    exit_script = Column(Text, nullable=True)
    stop_loss_pct = Column(Float, nullable=True)
    take_profit_pct = Column(Float, nullable=True)
    max_hold_days = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BackplayRun(Base):
    """One completed (or failed) backtest, with its full inputs and results."""

    __tablename__ = "backplay_runs"

    id = Column(Integer, primary_key=True, index=True)
    mode = Column(String(16), nullable=False)  # single | scan_top10
    status = Column(String(16), nullable=False, default="completed")  # completed | failed
    symbol = Column(String(20), nullable=True, index=True)
    preset_key = Column(String(64), nullable=True)
    preset_name = Column(String(100), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    strategy_json = Column(JSON, nullable=True)  # StrategySpec snapshot
    results_json = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class PaperSetup(Base):
    """An ongoing paper-trading experiment: a rule that runs until stopped."""

    __tablename__ = "paper_setups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    status = Column(String(16), nullable=False, default="active", index=True)  # active | stopped
    source_kind = Column(String(16), nullable=False, default="symbol")  # symbol | preset
    symbol = Column(String(20), nullable=True)
    preset_key = Column(String(64), nullable=True)
    top_n = Column(Integer, nullable=False, default=10)
    market = Column(String(8), nullable=False, default="US")
    strategy_json = Column(JSON, nullable=False)  # StrategySpec snapshot
    position_size = Column(Float, nullable=False, default=10_000.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    stopped_at = Column(DateTime(timezone=True), nullable=True)
    last_evaluated_at = Column(DateTime(timezone=True), nullable=True)


class PaperTrade(Base):
    """One simulated trade owned by a paper setup; events_json holds the timeline."""

    __tablename__ = "paper_trades"

    id = Column(Integer, primary_key=True, index=True)
    setup_id = Column(Integer, ForeignKey("paper_setups.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    status = Column(String(16), nullable=False, default="open", index=True)  # open | closed
    entry_date = Column(Date, nullable=True)
    entry_price = Column(Float, nullable=True)
    shares = Column(Float, nullable=True)
    exit_date = Column(Date, nullable=True)
    exit_price = Column(Float, nullable=True)
    return_pct = Column(Float, nullable=True)
    exit_reason = Column(String(32), nullable=True)
    events_json = Column(JSON, nullable=True)  # [{at, kind, detail}, ...]

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
