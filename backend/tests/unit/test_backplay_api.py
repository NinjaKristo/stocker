"""Tests for the Backplay API endpoints (run, history, presets, strategies)."""

import json

import pandas as pd
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1 import backplay as backplay_api
from app.database import Base
from app.models.backplay import BackplayRun, BackplayStrategy
from app.models.filter_preset import FilterPreset
from app.schemas.backplay import (
    BackplayRunRequest,
    ScriptValidationRequest,
    StrategyCreate,
    StrategyInput,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def synthetic_df(closes, start="2024-01-02"):
    closes = [float(c) for c in closes]
    return pd.DataFrame(
        {
            "Open": closes,
            "High": closes,
            "Low": closes,
            "Close": closes,
            "Volume": [1_000_000] * len(closes),
        },
        index=pd.bdate_range(start, periods=len(closes)),
    )


@pytest.fixture
def fake_prices(monkeypatch):
    frames = {"TEST": synthetic_df([1, 11, 12, 13, 14])}

    def _load(symbol, market=None):
        return frames.get(symbol.upper())

    monkeypatch.setattr(backplay_api, "_load_price_frame", _load)
    return frames


def script_strategy(entry="close > 10", **kwargs):
    return StrategyInput(kind="script", entry_script=entry, **kwargs)


@pytest.mark.asyncio
class TestRunSingle:
    async def test_single_mode_backtests_symbol_and_persists_run(self, db_session, fake_prices):
        request = BackplayRunRequest(mode="single", symbol="TEST", strategy=script_strategy())
        response = await backplay_api.run_backplay(request=request, db=db_session)

        assert response["status"] == "completed"
        assert response["results"]["summary"]["num_trades"] == 1
        assert response["results"]["trades"][0]["entry_price"] == 12.0

        stored = db_session.query(BackplayRun).all()
        assert len(stored) == 1
        assert stored[0].mode == "single"
        assert stored[0].symbol == "TEST"

    async def test_single_mode_requires_symbol(self, db_session, fake_prices):
        request = BackplayRunRequest(mode="single", strategy=script_strategy())
        with pytest.raises(HTTPException) as exc_info:
            await backplay_api.run_backplay(request=request, db=db_session)
        assert exc_info.value.status_code == 422

    async def test_unknown_symbol_returns_404(self, db_session, fake_prices):
        request = BackplayRunRequest(mode="single", symbol="NOPE", strategy=script_strategy())
        with pytest.raises(HTTPException) as exc_info:
            await backplay_api.run_backplay(request=request, db=db_session)
        assert exc_info.value.status_code == 404

    async def test_bad_script_returns_422_with_message(self, db_session, fake_prices):
        request = BackplayRunRequest(
            mode="single", symbol="TEST", strategy=script_strategy(entry="closs > 10")
        )
        with pytest.raises(HTTPException) as exc_info:
            await backplay_api.run_backplay(request=request, db=db_session)
        assert exc_info.value.status_code == 422
        assert "unknown" in str(exc_info.value.detail).lower()

    async def test_date_range_slices_history(self, db_session, fake_prices):
        fake_prices["TEST"] = synthetic_df([1, 11, 12, 13, 14, 15, 16, 17])
        index = fake_prices["TEST"].index
        request = BackplayRunRequest(
            mode="single",
            symbol="TEST",
            strategy=script_strategy(),
            start_date=index[4].date(),
            end_date=index[6].date(),
        )
        response = await backplay_api.run_backplay(request=request, db=db_session)
        assert response["results"]["summary"]["bars"] == 3


@pytest.mark.asyncio
class TestRunScanTop10:
    async def test_scan_mode_backtests_each_pick(self, db_session, fake_prices, monkeypatch):
        fake_prices["AAA"] = synthetic_df([1, 11, 12, 13, 14])
        fake_prices["BBB"] = synthetic_df([1, 11, 12, 9, 8])

        def fake_select(db, preset_key, top_n=10, market=None):
            return {
                "preset_name": "Fake Preset",
                "run": {"run_id": 1, "as_of_date": "2026-07-03"},
                "picks": [
                    {"symbol": "AAA", "company_name": None, "composite_score": 90, "sort_value": 90},
                    {"symbol": "BBB", "company_name": None, "composite_score": 80, "sort_value": 80},
                ],
            }

        monkeypatch.setattr(backplay_api, "select_top_symbols", fake_select)

        request = BackplayRunRequest(
            mode="scan_top10", preset_key="builtin:minervini", strategy=script_strategy()
        )
        response = await backplay_api.run_backplay(request=request, db=db_session)

        assert response["status"] == "completed"
        per_symbol = response["results"]["per_symbol"]
        assert [entry["symbol"] for entry in per_symbol] == ["AAA", "BBB"]
        assert response["results"]["combined"]["symbols_tested"] == 2
        assert response["preset_name"] == "Fake Preset"

    async def test_scan_mode_requires_preset_key(self, db_session, fake_prices):
        request = BackplayRunRequest(mode="scan_top10", strategy=script_strategy())
        with pytest.raises(HTTPException) as exc_info:
            await backplay_api.run_backplay(request=request, db=db_session)
        assert exc_info.value.status_code == 422


@pytest.mark.asyncio
class TestHistoryAndCatalogs:
    async def test_list_runs_returns_newest_first(self, db_session, fake_prices):
        for _ in range(2):
            request = BackplayRunRequest(mode="single", symbol="TEST", strategy=script_strategy())
            await backplay_api.run_backplay(request=request, db=db_session)

        listing = await backplay_api.list_runs(db=db_session, limit=10)
        assert len(listing["runs"]) == 2
        assert listing["runs"][0]["id"] >= listing["runs"][1]["id"]
        # Listing rows must stay light: no bulky results payload.
        assert "results" not in listing["runs"][0]

    async def test_get_run_returns_full_results(self, db_session, fake_prices):
        request = BackplayRunRequest(mode="single", symbol="TEST", strategy=script_strategy())
        created = await backplay_api.run_backplay(request=request, db=db_session)
        fetched = await backplay_api.get_run(run_id=created["id"], db=db_session)
        assert fetched["results"]["summary"]["num_trades"] == 1

    async def test_get_missing_run_404s(self, db_session):
        with pytest.raises(HTTPException) as exc_info:
            await backplay_api.get_run(run_id=12345, db=db_session)
        assert exc_info.value.status_code == 404

    async def test_presets_catalog_merges_builtin_and_custom(self, db_session):
        db_session.add(
            FilterPreset(
                name="Mine",
                filters=json.dumps({}),
                sort_by="composite_score",
                sort_order="desc",
                position=0,
            )
        )
        db_session.commit()
        catalog = await backplay_api.get_presets(db=db_session)
        sources = {entry["source"] for entry in catalog["presets"]}
        assert sources == {"builtin", "custom"}

    async def test_builtins_catalog_lists_strategies(self):
        catalog = await backplay_api.get_builtin_strategies()
        ids = {entry["id"] for entry in catalog["builtins"]}
        assert {"breakout", "ma_cross", "buy_hold"} <= ids


@pytest.mark.asyncio
class TestScriptValidation:
    async def test_valid_script(self):
        response = await backplay_api.validate_script(
            request=ScriptValidationRequest(script="close > SMA(close, 20)")
        )
        assert response["valid"] is True

    async def test_invalid_script_reports_error(self):
        response = await backplay_api.validate_script(
            request=ScriptValidationRequest(script="closs > 10")
        )
        assert response["valid"] is False
        assert "unknown" in response["error"].lower()


@pytest.mark.asyncio
class TestStrategyCrud:
    async def test_create_list_delete(self, db_session):
        payload = StrategyCreate(
            name="My breakout",
            strategy=StrategyInput(kind="script", entry_script="close > 10", stop_loss_pct=8.0),
        )
        created = await backplay_api.create_strategy(request=payload, db=db_session)
        assert created["name"] == "My breakout"

        listing = await backplay_api.list_strategies(db=db_session)
        assert len(listing["strategies"]) == 1

        await backplay_api.delete_strategy(strategy_id=created["id"], db=db_session)
        assert db_session.query(BackplayStrategy).count() == 0

    async def test_create_rejects_invalid_script(self, db_session):
        payload = StrategyCreate(
            name="Broken",
            strategy=StrategyInput(kind="script", entry_script="closs > 10"),
        )
        with pytest.raises(HTTPException) as exc_info:
            await backplay_api.create_strategy(request=payload, db=db_session)
        assert exc_info.value.status_code == 422

    async def test_duplicate_name_rejected(self, db_session):
        payload = StrategyCreate(
            name="Dupe",
            strategy=StrategyInput(kind="script", entry_script="close > 10"),
        )
        await backplay_api.create_strategy(request=payload, db=db_session)
        with pytest.raises(HTTPException) as exc_info:
            await backplay_api.create_strategy(request=payload, db=db_session)
        assert exc_info.value.status_code == 400
