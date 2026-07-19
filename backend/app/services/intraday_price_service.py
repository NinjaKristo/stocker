"""Short-lived delayed intraday prices kept outside the durable daily cache."""
from __future__ import annotations

from datetime import UTC, datetime
import json
import logging
import math
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)


class IntradayPriceUnavailable(RuntimeError):
    """Raised when the public delayed provider cannot return usable bars."""


class IntradayPriceService:
    """Fetch and briefly cache delayed five-minute Yahoo Finance bars."""

    CACHE_VERSION = "v1"
    CACHE_TTL_SECONDS = 60
    PERIOD_BY_INTERVAL = {"5m": "5d"}

    def __init__(self, *, yfinance_service, redis_client=None):
        self._yfinance_service = yfinance_service
        self._redis_client = redis_client

    def get(self, symbol: str, *, interval: str = "5m") -> dict[str, Any]:
        normalized_symbol = str(symbol).strip().upper()
        period = self.PERIOD_BY_INTERVAL.get(interval)
        if period is None:
            raise ValueError(f"Unsupported intraday interval: {interval}")

        cache_key = self._cache_key(normalized_symbol, interval)
        cached = self._read_cache(cache_key)
        if cached is not None:
            return {**cached, "cache_status": "hit"}

        frame = self._yfinance_service.get_historical_data(
            normalized_symbol,
            period=period,
            interval=interval,
            use_cache=False,
        )
        bars = self._frame_to_bars(frame)
        if not bars:
            raise IntradayPriceUnavailable(
                f"Delayed intraday data is unavailable for {normalized_symbol}"
            )

        fetched_at = datetime.now(UTC).isoformat()
        payload = {
            "symbol": normalized_symbol,
            "interval": interval,
            "period": period,
            "source": "Yahoo Finance via yfinance",
            "source_type": "public_delayed",
            "is_realtime": False,
            "disclosure": "Delayed market data. Do not use for order execution.",
            "fetched_at": fetched_at,
            "latest_bar_at": bars[-1]["timestamp"],
            "cache_ttl_seconds": self.CACHE_TTL_SECONDS,
            "bars": bars,
        }
        self._write_cache(cache_key, payload)
        return {**payload, "cache_status": "miss"}

    @classmethod
    def _cache_key(cls, symbol: str, interval: str) -> str:
        return f"intraday:{cls.CACHE_VERSION}:{symbol}:{interval}"

    def _read_cache(self, key: str) -> dict[str, Any] | None:
        if self._redis_client is None:
            return None
        try:
            raw = self._redis_client.get(key)
            if not raw:
                return None
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            payload = json.loads(raw)
            return payload if isinstance(payload, dict) and payload.get("bars") else None
        except Exception as exc:
            logger.warning("Intraday cache read failed for %s: %s", key, exc)
            return None

    def _write_cache(self, key: str, payload: dict[str, Any]) -> None:
        if self._redis_client is None:
            return
        try:
            self._redis_client.setex(
                key,
                self.CACHE_TTL_SECONDS,
                json.dumps(payload, separators=(",", ":")),
            )
        except Exception as exc:
            logger.warning("Intraday cache write failed for %s: %s", key, exc)

    @staticmethod
    def _frame_to_bars(frame: pd.DataFrame | None) -> list[dict[str, Any]]:
        if frame is None or frame.empty:
            return []

        normalized = frame.copy()
        if isinstance(normalized.columns, pd.MultiIndex):
            normalized.columns = [str(column[0]) for column in normalized.columns]
        normalized = normalized.rename(columns=lambda value: str(value).strip().lower())
        required = {"open", "high", "low", "close", "volume"}
        if not required.issubset(normalized.columns):
            return []

        bars: list[dict[str, Any]] = []
        for row in normalized[["open", "high", "low", "close", "volume"]].itertuples():
            timestamp = pd.Timestamp(row.Index)
            if pd.isna(timestamp):
                continue
            if timestamp.tzinfo is None:
                timestamp = timestamp.tz_localize(UTC)

            prices = [row.open, row.high, row.low, row.close]
            try:
                prices = [float(value) for value in prices]
            except (TypeError, ValueError):
                continue
            if not all(math.isfinite(value) for value in prices):
                continue

            try:
                volume = int(float(row.volume)) if pd.notna(row.volume) else 0
            except (TypeError, ValueError, OverflowError):
                volume = 0

            bars.append(
                {
                    "timestamp": timestamp.isoformat(),
                    "open": prices[0],
                    "high": prices[1],
                    "low": prices[2],
                    "close": prices[3],
                    "volume": max(0, volume),
                }
            )

        bars.sort(key=lambda bar: pd.Timestamp(bar["timestamp"]).timestamp())
        return bars
