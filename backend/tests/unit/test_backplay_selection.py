"""Tests for Backplay scan-preset top-N selection (mode 2)."""

import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.filter_preset import FilterPreset
from app.services.backplay.selection import pick_top, resolve_preset


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def row(symbol, composite=50.0, rs=50, stage=2, **extra):
    return {
        "symbol": symbol,
        "composite_score": composite,
        "rs_rating": rs,
        "stage": stage,
        **extra,
    }


class TestPickTop:
    def test_filters_and_ranks_by_preset_sort(self):
        preset = {
            "filters": {"rsRating": {"min": 80, "max": None}},
            "sort_by": "composite_score",
            "sort_order": "desc",
        }
        rows = [
            row("WEAK", composite=99, rs=10),
            row("MID", composite=60, rs=85),
            row("TOP", composite=90, rs=95),
        ]
        picks = pick_top(rows, preset, top_n=10)
        assert [r["symbol"] for r in picks] == ["TOP", "MID"]

    def test_limits_to_top_n(self):
        preset = {"filters": {}, "sort_by": "composite_score", "sort_order": "desc"}
        rows = [row(f"S{i}", composite=i) for i in range(30)]
        picks = pick_top(rows, preset, top_n=10)
        assert len(picks) == 10
        assert picks[0]["symbol"] == "S29"

    def test_rows_missing_sort_field_rank_last(self):
        preset = {"filters": {}, "sort_by": "composite_score", "sort_order": "desc"}
        rows = [row("NONE", composite=None), row("REAL", composite=5)]
        picks = pick_top(rows, preset, top_n=2)
        assert picks[0]["symbol"] == "REAL"


class TestResolvePreset:
    def test_builtin_preset_by_key(self, db_session):
        preset = resolve_preset(db_session, "builtin:minervini")
        assert preset["name"] == "Minervini Trend Template"
        assert "minerviniScore" in preset["filters"]

    def test_custom_preset_by_id(self, db_session):
        db_session.add(
            FilterPreset(
                name="My picks",
                description=None,
                filters=json.dumps({"rsRating": {"min": 90, "max": None}}),
                sort_by="rs_rating",
                sort_order="desc",
                position=0,
            )
        )
        db_session.commit()
        preset_id = db_session.query(FilterPreset).first().id

        preset = resolve_preset(db_session, f"custom:{preset_id}")
        assert preset["name"] == "My picks"
        assert preset["filters"]["rsRating"]["min"] == 90
        assert preset["sort_by"] == "rs_rating"

    def test_unknown_builtin_raises(self, db_session):
        with pytest.raises(ValueError, match="(?i)unknown"):
            resolve_preset(db_session, "builtin:nope")

    def test_missing_custom_raises(self, db_session):
        with pytest.raises(ValueError, match="(?i)not found"):
            resolve_preset(db_session, "custom:999")

    def test_malformed_key_raises(self, db_session):
        with pytest.raises(ValueError, match="(?i)preset key"):
            resolve_preset(db_session, "whatever")
