from __future__ import annotations

import httpx
import pytest
import pytest_asyncio

from app.api.v1 import stocks as stocks_module
from app.main import app
from app.services import server_auth
from app.services.intraday_price_service import IntradayPriceUnavailable

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as value:
        yield value


@pytest.fixture(autouse=True)
def _disable_server_auth(monkeypatch):
    monkeypatch.setattr(server_auth.settings, "server_auth_enabled", False)


class _FakeIntradayService:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error
        self.calls = []

    def get(self, symbol, *, interval):
        self.calls.append((symbol, interval))
        if self.error:
            raise self.error
        return self.payload


def _payload():
    return {
        "symbol": "AAPL",
        "interval": "5m",
        "period": "5d",
        "source": "Yahoo Finance via yfinance",
        "source_type": "public_delayed",
        "is_realtime": False,
        "disclosure": "Delayed market data. Do not use for order execution.",
        "fetched_at": "2026-07-17T20:00:00+00:00",
        "latest_bar_at": "2026-07-17T15:55:00-04:00",
        "cache_ttl_seconds": 60,
        "cache_status": "miss",
        "bars": [
            {
                "timestamp": "2026-07-17T15:55:00-04:00",
                "open": 210.0,
                "high": 211.0,
                "low": 209.5,
                "close": 210.5,
                "volume": 1234,
            }
        ],
    }


@pytest.mark.asyncio
async def test_intraday_endpoint_returns_explicit_delayed_contract(client, monkeypatch):
    service = _FakeIntradayService(payload=_payload())
    monkeypatch.setattr(stocks_module, "_get_intraday_price_service", lambda: service)

    response = await client.get("/api/v1/stocks/aapl/intraday", params={"interval": "5m"})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["is_realtime"] is False
    assert body["latest_bar_at"] == "2026-07-17T15:55:00-04:00"
    assert body["bars"][0]["timestamp"].endswith("-04:00")
    assert service.calls == [("AAPL", "5m")]


@pytest.mark.asyncio
async def test_intraday_endpoint_rejects_unsupported_interval(client):
    response = await client.get("/api/v1/stocks/AAPL/intraday", params={"interval": "1m"})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_intraday_endpoint_reports_provider_unavailability(client, monkeypatch):
    service = _FakeIntradayService(
        error=IntradayPriceUnavailable("Delayed intraday data is unavailable for AAPL")
    )
    monkeypatch.setattr(stocks_module, "_get_intraday_price_service", lambda: service)

    response = await client.get("/api/v1/stocks/AAPL/intraday")

    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"]
