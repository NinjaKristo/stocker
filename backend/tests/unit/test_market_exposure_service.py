"""Unit tests for the market exposure rubric and DB round-trip."""
from datetime import date

import pandas as pd

import app.services.market_exposure_service as svc
from app.services.market_exposure_service import (
    CAP_BELOW_200DMA,
    CAP_DISTRIBUTION_5PLUS,
    build_exposure_payload,
    compute_and_store,
    count_distribution_days,
    compute_trend,
    _score,
    _stance,
)


def _df(closes, volumes):
    """Build a minimal OHLCV DataFrame with a DatetimeIndex."""
    idx = pd.date_range("2024-01-01", periods=len(closes), freq="D")
    return pd.DataFrame(
        {"Open": closes, "High": closes, "Low": closes, "Close": closes, "Volume": volumes},
        index=idx,
    )


def test_count_distribution_days_counts_down_days_on_higher_volume():
    # 3 down days (-0.3%) each on rising volume -> distribution days.
    # A 4th down day on FALLING volume must NOT count; the final up day must not.
    closes = [100.0, 99.7, 99.4, 99.1, 98.8, 99.5]
    volumes = [1000, 1100, 1200, 1300, 1200, 1400]
    assert count_distribution_days(_df(closes, volumes)) == 3


def test_count_distribution_days_empty_is_zero():
    assert count_distribution_days(_df([100.0], [1000])) == 0


def test_compute_trend_downtrend_is_bearish():
    closes = list(range(250, 0, -1))  # strictly decreasing -> price < ma50 < ma200
    trend = compute_trend(_df(closes, [1000] * len(closes)))
    assert trend["trend"] == "bearish"
    assert trend["price"] < trend["ma50"] < trend["ma200"]


def test_score_below_200dma_caps_low():
    score, components = _score(
        {"price": 90, "ma50": 100, "ma200": 110}, dist_count=0, ftd=False, vix=None, net_4pct=None
    )
    assert score <= CAP_BELOW_200DMA
    assert "below_200dma_cap" in components


def test_score_five_distribution_days_hard_caps():
    score, _ = _score(
        {"price": 120, "ma50": 110, "ma200": 100}, dist_count=5, ftd=False, vix=None, net_4pct=None
    )
    assert score <= CAP_DISTRIBUTION_5PLUS


def test_stance_bands():
    assert _stance(90) == "Power Trend"
    assert _stance(10) == "Correction — In Cash"


class _FakeBundle:
    def __init__(self, df, symbol):
        self.data = df
        self.benchmark_symbol = symbol


def _fake_benchmark_factory(df, symbol="SPY"):
    class _FakeBenchmarkCacheService:
        def __init__(self, *a, **k):
            pass

        def get_benchmark_bundle(self, market="US", period="2y", force_refresh=False):
            return _FakeBundle(df, symbol)

    return _FakeBenchmarkCacheService


def test_compute_and_store_round_trip_validates_against_schema(monkeypatch):
    from app.database import SessionLocal
    from app.models.market_exposure import MarketExposure
    from app.schemas.market_scan import MarketHealthExposure

    # 250-session uptrend -> price > ma50 > ma200, no distribution days.
    closes = list(range(100, 350))
    df = _df(closes, [1000] * len(closes))
    monkeypatch.setattr(
        "app.services.benchmark_cache_service.BenchmarkCacheService",
        _fake_benchmark_factory(df),
    )

    as_of = df.index[-1].date()
    db = SessionLocal()
    try:
        result = compute_and_store("US", as_of, db)
        assert "error" not in result
        assert result["stance"] == "Power Trend"  # clean uptrend, no penalties

        row = db.query(MarketExposure).filter(MarketExposure.date == as_of, MarketExposure.market == "US").one()
        assert row.exposure_score == 100.0
        assert row.benchmark_symbol == "SPY"

        payload = build_exposure_payload(db, "US")
        # The strict (extra="forbid") schema is the live + static contract.
        MarketHealthExposure.model_validate(payload)
        assert payload["exposure_score"] == 100.0
        assert payload["history"][-1]["date"] == as_of.isoformat()
    finally:
        db.close()


def test_ensure_exposure_history_seeds_then_skips(monkeypatch):
    from app.database import SessionLocal
    from app.models.market_exposure import MarketExposure
    from app.services.market_exposure_service import ensure_exposure_history

    df = _df(list(range(100, 350)), [1000] * 250)
    monkeypatch.setattr(
        "app.services.benchmark_cache_service.BenchmarkCacheService",
        _fake_benchmark_factory(df),
    )
    db = SessionLocal()
    try:
        first = ensure_exposure_history(db, "US", min_rows=2, days=12)
        assert first["seeded"] >= 1
        count = db.query(MarketExposure).filter(MarketExposure.market == "US").count()
        assert count == first["seeded"]

        # Second call is a no-op: history is now above the threshold.
        second = ensure_exposure_history(db, "US", min_rows=2, days=12)
        assert second.get("skipped") is True
        assert second["seeded"] == 0
        assert db.query(MarketExposure).filter(MarketExposure.market == "US").count() == count
    finally:
        db.close()


def test_compute_and_store_skips_write_when_no_benchmark(monkeypatch):
    from app.database import SessionLocal
    from app.models.market_exposure import MarketExposure

    monkeypatch.setattr(
        "app.services.benchmark_cache_service.BenchmarkCacheService",
        _fake_benchmark_factory(None),
    )
    db = SessionLocal()
    try:
        result = compute_and_store("US", date(2026, 6, 16), db)
        assert result.get("error") == "no_benchmark_data"
        assert db.query(MarketExposure).count() == 0
    finally:
        db.close()
