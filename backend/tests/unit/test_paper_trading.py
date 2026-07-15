"""Tests for paper-trading evaluation and its API.

Paper convention (differs from backtests, stated in the UI): evaluation runs
after the close, so fills happen at the close of the signal day. Evaluation is
catch-up safe — bars since the last check are replayed deterministically.
"""

from datetime import date

import pandas as pd
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1 import paper as paper_api
from app.database import Base
from app.models.backplay import PaperSetup, PaperTrade
from app.schemas.backplay import PaperSetupCreate, StrategyInput
from app.services.backplay import paper as paper_service


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def synthetic_df(closes, start="2024-01-02", lows=None, highs=None):
    closes = [float(c) for c in closes]
    return pd.DataFrame(
        {
            "Open": closes,
            "High": highs if highs is not None else closes,
            "Low": lows if lows is not None else closes,
            "Close": closes,
            "Volume": [1_000_000] * len(closes),
        },
        index=pd.bdate_range(start, periods=len(closes)),
    )


def make_setup(db, *, entry="close > 10", exit=None, symbol="TEST", **kwargs):
    setup = PaperSetup(
        name=kwargs.pop("name", "My setup"),
        status="active",
        source_kind="symbol",
        symbol=symbol,
        strategy_json={
            "kind": "script",
            "entry_script": entry,
            "exit_script": exit,
            "params": {},
            **kwargs,
        },
        position_size=10_000.0,
    )
    db.add(setup)
    db.commit()
    db.refresh(setup)
    return setup


class TestEvaluateSetup:
    def test_entry_signal_on_latest_bar_opens_trade_at_close(self, db_session):
        setup = make_setup(db_session)
        prices = {"TEST": synthetic_df([1, 2, 11])}

        result = paper_service.evaluate_setup(
            db_session, setup, price_loader=lambda s, market=None: prices.get(s)
        )

        trades = db_session.query(PaperTrade).all()
        assert len(trades) == 1
        assert trades[0].status == "open"
        assert trades[0].entry_price == 11.0
        assert trades[0].entry_date == date(2024, 1, 4)
        assert result["opened"] == 1

    def test_no_signal_no_trade(self, db_session):
        setup = make_setup(db_session)
        prices = {"TEST": synthetic_df([1, 2, 3])}
        result = paper_service.evaluate_setup(
            db_session, setup, price_loader=lambda s, market=None: prices.get(s)
        )
        assert db_session.query(PaperTrade).count() == 0
        assert result["opened"] == 0

    def test_does_not_duplicate_open_trade_on_reevaluation(self, db_session):
        setup = make_setup(db_session)
        prices = {"TEST": synthetic_df([1, 2, 11])}
        loader = lambda s, market=None: prices.get(s)  # noqa: E731
        paper_service.evaluate_setup(db_session, setup, price_loader=loader)
        paper_service.evaluate_setup(db_session, setup, price_loader=loader)
        assert db_session.query(PaperTrade).count() == 1

    def test_exit_rule_closes_open_trade(self, db_session):
        setup = make_setup(db_session, exit="close < 5")
        prices = {"TEST": synthetic_df([1, 2, 11])}
        loader = lambda s, market=None: prices.get(s)  # noqa: E731
        paper_service.evaluate_setup(db_session, setup, price_loader=loader)

        # New bar arrives below the exit threshold.
        prices["TEST"] = synthetic_df([1, 2, 11, 4])
        result = paper_service.evaluate_setup(db_session, setup, price_loader=loader)

        trade = db_session.query(PaperTrade).one()
        assert trade.status == "closed"
        assert trade.exit_reason == "exit_rule"
        assert trade.exit_price == 4.0
        assert trade.return_pct == pytest.approx((4 / 11 - 1) * 100)
        assert result["closed"] == 1

    def test_stop_loss_closes_intrabar(self, db_session):
        setup = make_setup(db_session, stop_loss_pct=10.0)
        prices = {"TEST": synthetic_df([1, 2, 11])}
        loader = lambda s, market=None: prices.get(s)  # noqa: E731
        paper_service.evaluate_setup(db_session, setup, price_loader=loader)

        prices["TEST"] = synthetic_df([1, 2, 11, 10.5], lows=[1, 2, 11, 9.5])
        paper_service.evaluate_setup(db_session, setup, price_loader=loader)

        trade = db_session.query(PaperTrade).one()
        assert trade.status == "closed"
        assert trade.exit_reason == "stop_loss"
        assert trade.exit_price == pytest.approx(11 * 0.9)

    def test_catch_up_after_missed_days(self, db_session):
        # Trade opened, then several bars arrive at once; the exit that
        # happened two bars ago is still honored at that bar's close.
        setup = make_setup(db_session, exit="close < 5")
        prices = {"TEST": synthetic_df([1, 2, 11])}
        loader = lambda s, market=None: prices.get(s)  # noqa: E731
        paper_service.evaluate_setup(db_session, setup, price_loader=loader)

        prices["TEST"] = synthetic_df([1, 2, 11, 4, 3, 9])
        paper_service.evaluate_setup(db_session, setup, price_loader=loader)

        trade = db_session.query(PaperTrade).one()
        assert trade.status == "closed"
        assert trade.exit_price == 4.0  # the first bar the exit rule fired

    def test_events_timeline_recorded(self, db_session):
        setup = make_setup(db_session, exit="close < 5")
        prices = {"TEST": synthetic_df([1, 2, 11])}
        loader = lambda s, market=None: prices.get(s)  # noqa: E731
        paper_service.evaluate_setup(db_session, setup, price_loader=loader)
        prices["TEST"] = synthetic_df([1, 2, 11, 4])
        paper_service.evaluate_setup(db_session, setup, price_loader=loader)

        trade = db_session.query(PaperTrade).one()
        kinds = [event["kind"] for event in trade.events_json]
        assert "opened" in kinds
        assert "closed" in kinds

    def test_stopped_setup_is_not_evaluated(self, db_session):
        setup = make_setup(db_session)
        setup.status = "stopped"
        db_session.commit()
        prices = {"TEST": synthetic_df([1, 2, 11])}

        summary = paper_service.evaluate_active_setups(
            db_session, price_loader=lambda s, market=None: prices.get(s)
        )
        assert summary["setups_evaluated"] == 0
        assert db_session.query(PaperTrade).count() == 0


@pytest.mark.asyncio
class TestPaperApi:
    async def test_create_setup_validates_and_persists(self, db_session):
        payload = PaperSetupCreate(
            name="Breakout watch",
            source_kind="symbol",
            symbol="test",
            strategy=StrategyInput(kind="script", entry_script="close > 10"),
        )
        created = await paper_api.create_setup(request=payload, db=db_session)
        assert created["symbol"] == "TEST"
        assert created["status"] == "active"

    async def test_create_setup_rejects_bad_script(self, db_session):
        payload = PaperSetupCreate(
            name="Broken",
            source_kind="symbol",
            symbol="TEST",
            strategy=StrategyInput(kind="script", entry_script="closs > 10"),
        )
        with pytest.raises(HTTPException) as exc_info:
            await paper_api.create_setup(request=payload, db=db_session)
        assert exc_info.value.status_code == 422

    async def test_create_symbol_setup_requires_symbol(self, db_session):
        payload = PaperSetupCreate(
            name="No symbol",
            source_kind="symbol",
            strategy=StrategyInput(kind="script", entry_script="close > 10"),
        )
        with pytest.raises(HTTPException) as exc_info:
            await paper_api.create_setup(request=payload, db=db_session)
        assert exc_info.value.status_code == 422

    async def test_stop_and_restart_setup(self, db_session):
        payload = PaperSetupCreate(
            name="Stopper",
            source_kind="symbol",
            symbol="TEST",
            strategy=StrategyInput(kind="script", entry_script="close > 10"),
        )
        created = await paper_api.create_setup(request=payload, db=db_session)

        stopped = await paper_api.stop_setup(setup_id=created["id"], db=db_session)
        assert stopped["status"] == "stopped"

        restarted = await paper_api.start_setup(setup_id=created["id"], db=db_session)
        assert restarted["status"] == "active"

    async def test_list_trades_for_setup(self, db_session):
        setup = make_setup(db_session)
        db_session.add(
            PaperTrade(
                setup_id=setup.id,
                symbol="TEST",
                status="open",
                entry_date=date(2024, 1, 4),
                entry_price=11.0,
                shares=909.09,
                events_json=[{"at": "2024-01-04", "kind": "opened", "detail": "entry rule fired"}],
            )
        )
        db_session.commit()

        listing = await paper_api.list_trades(db=db_session, setup_id=setup.id, limit=50)
        assert len(listing["trades"]) == 1
        assert listing["trades"][0]["events"][0]["kind"] == "opened"
