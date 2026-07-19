from __future__ import annotations

import json

import pandas as pd
import pytest

from app.services.intraday_price_service import (
    IntradayPriceService,
    IntradayPriceUnavailable,
)


class _FakeYFinance:
    def __init__(self, frame):
        self.frame = frame
        self.calls = []

    def get_historical_data(self, symbol, **kwargs):
        self.calls.append((symbol, kwargs))
        return self.frame


class _FakeRedis:
    def __init__(self):
        self.values = {}
        self.set_calls = []

    def get(self, key):
        return self.values.get(key)

    def setex(self, key, ttl, value):
        self.values[key] = value
        self.set_calls.append((key, ttl, value))


def _frame():
    index = pd.date_range(
        "2026-07-17 09:30",
        periods=2,
        freq="5min",
        tz="America/New_York",
        name="Datetime",
    )
    return pd.DataFrame(
        {
            "Open": [100.0, 101.0],
            "High": [102.0, 103.0],
            "Low": [99.0, 100.0],
            "Close": [101.0, 102.0],
            "Volume": [1_000, 1_200],
        },
        index=index,
    )


def test_fetches_timestamped_delayed_bars_and_caches_payload():
    provider = _FakeYFinance(_frame())
    redis = _FakeRedis()
    service = IntradayPriceService(yfinance_service=provider, redis_client=redis)

    payload = service.get("aapl", interval="5m")

    assert payload["symbol"] == "AAPL"
    assert payload["is_realtime"] is False
    assert payload["source"] == "Yahoo Finance via yfinance"
    assert payload["cache_status"] == "miss"
    assert payload["bars"][0]["timestamp"] == "2026-07-17T09:30:00-04:00"
    assert payload["latest_bar_at"] == "2026-07-17T09:35:00-04:00"
    assert provider.calls == [
        ("AAPL", {"period": "5d", "interval": "5m", "use_cache": False})
    ]
    assert redis.set_calls[0][1] == 60


def test_redis_hit_avoids_another_provider_request():
    provider = _FakeYFinance(_frame())
    redis = _FakeRedis()
    service = IntradayPriceService(yfinance_service=provider, redis_client=redis)

    first = service.get("MSFT")
    second = service.get("MSFT")

    assert first["cache_status"] == "miss"
    assert second["cache_status"] == "hit"
    assert len(provider.calls) == 1
    assert json.loads(redis.values["intraday:v1:MSFT:5m"])["symbol"] == "MSFT"


def test_malformed_or_empty_provider_frame_fails_honestly():
    provider = _FakeYFinance(pd.DataFrame({"Close": [1.0]}))
    service = IntradayPriceService(yfinance_service=provider)

    with pytest.raises(IntradayPriceUnavailable, match="unavailable for NVDA"):
        service.get("NVDA")


def test_rejects_unsupported_intervals_before_provider_call():
    provider = _FakeYFinance(_frame())
    service = IntradayPriceService(yfinance_service=provider)

    with pytest.raises(ValueError, match="Unsupported intraday interval"):
        service.get("AAPL", interval="1m")

    assert provider.calls == []
