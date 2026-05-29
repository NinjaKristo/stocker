"""Stable Market facts and lookup helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .market import Market
from .mic_aliases import mic_alias_registry


@dataclass(frozen=True, slots=True)
class MarketProfile:
    """Stable facts about one supported Market."""

    market: Market
    label: str
    currency: str
    timezone_name: str
    calendar_id: str
    provider_calendar_id: str | None
    exchanges: tuple[str, ...]
    primary_benchmark_symbol: str
    benchmark_fallback_symbol: str | None
    benchmark_primary_kind: str
    benchmark_fallback_kind: str | None

    @property
    def indexes(self) -> tuple[str, ...]:
        """Derived compatibility summary; IndexRegistry owns definitions."""
        from ..universe.indexes import index_registry

        return tuple(
            definition.key for definition in index_registry.definitions(self.market.code)
        )


class MarketRegistry:
    """Registry of stable Market facts.

    Runtime Preferences and Market Workload are separate concepts. This module
    owns stable identity and lookup facts only.
    """

    def __init__(self, profiles: Iterable[MarketProfile]) -> None:
        self._profiles = tuple(profiles)
        self._by_code: dict[str, MarketProfile] = {}

        for profile in self._profiles:
            code = profile.market.code
            if code in self._by_code:
                raise ValueError(f"Duplicate market profile: {code}")
            self._by_code[code] = profile

    def profile(self, market: Market | str) -> MarketProfile:
        resolved = market if isinstance(market, Market) else Market.from_str(market)
        return self._by_code[resolved.code]

    def profiles(self) -> tuple[MarketProfile, ...]:
        return self._profiles

    def supported_markets(self) -> tuple[Market, ...]:
        return tuple(profile.market for profile in self._profiles)

    def supported_market_codes(self) -> tuple[str, ...]:
        return tuple(profile.market.code for profile in self._profiles)

    def market_for_exchange(self, exchange: str | None) -> Market | None:
        resolved = mic_alias_registry.resolve_global(exchange)
        if resolved is None:
            return None
        return Market(resolved.market)

    def mic_for_exchange(
        self, market: Market | str | None, exchange: str | None
    ) -> str | None:
        if market is None:
            return None
        market_code = market.code if isinstance(market, Market) else str(market)
        resolved = mic_alias_registry.resolve(market_code, exchange)
        return resolved.mic if resolved else None

    def market_for_index(self, index: str | None) -> Market | None:
        from ..universe.indexes import index_registry

        market_code = index_registry.market_for(index)
        if market_code is None:
            return None
        return Market(market_code)


market_registry = MarketRegistry(
    (
        MarketProfile(
            market=Market("US"),
            label="United States",
            currency="USD",
            timezone_name="America/New_York",
            calendar_id="XNYS",
            provider_calendar_id=None,
            exchanges=("NYSE", "NASDAQ", "AMEX", "XNYS", "XNAS", "XASE"),
            primary_benchmark_symbol="SPY",
            benchmark_fallback_symbol="IVV",
            benchmark_primary_kind="etf",
            benchmark_fallback_kind="etf",
        ),
        MarketProfile(
            market=Market("HK"),
            label="Hong Kong",
            currency="HKD",
            timezone_name="Asia/Hong_Kong",
            calendar_id="XHKG",
            provider_calendar_id=None,
            exchanges=("HKEX", "SEHK", "XHKG"),
            primary_benchmark_symbol="^HSI",
            benchmark_fallback_symbol="2800.HK",
            benchmark_primary_kind="index",
            benchmark_fallback_kind="etf",
        ),
        MarketProfile(
            market=Market("IN"),
            label="India",
            currency="INR",
            timezone_name="Asia/Kolkata",
            calendar_id="XNSE",
            provider_calendar_id="NSE",
            exchanges=("NSE", "XNSE", "BSE", "XBOM"),
            primary_benchmark_symbol="^NSEI",
            benchmark_fallback_symbol="NIFTYBEES.NS",
            benchmark_primary_kind="index",
            benchmark_fallback_kind="etf",
        ),
        MarketProfile(
            market=Market("JP"),
            label="Japan",
            currency="JPY",
            timezone_name="Asia/Tokyo",
            calendar_id="XTKS",
            provider_calendar_id=None,
            exchanges=("TSE", "JPX", "XTKS"),
            primary_benchmark_symbol="^N225",
            benchmark_fallback_symbol="1306.T",
            benchmark_primary_kind="index",
            benchmark_fallback_kind="etf",
        ),
        MarketProfile(
            market=Market("KR"),
            label="South Korea",
            currency="KRW",
            timezone_name="Asia/Seoul",
            calendar_id="XKRX",
            provider_calendar_id=None,
            exchanges=("KOSPI", "KOSDAQ", "KRX", "XKRX"),
            primary_benchmark_symbol="^KS11",
            benchmark_fallback_symbol="069500.KS",
            benchmark_primary_kind="index",
            benchmark_fallback_kind="etf",
        ),
        MarketProfile(
            market=Market("TW"),
            label="Taiwan",
            currency="TWD",
            timezone_name="Asia/Taipei",
            calendar_id="XTAI",
            provider_calendar_id=None,
            exchanges=("TWSE", "TPEX", "XTAI"),
            primary_benchmark_symbol="^TWII",
            benchmark_fallback_symbol="0050.TW",
            benchmark_primary_kind="index",
            benchmark_fallback_kind="etf",
        ),
        MarketProfile(
            market=Market("CN"),
            label="China",
            currency="CNY",
            timezone_name="Asia/Shanghai",
            calendar_id="XSHG",
            provider_calendar_id=None,
            exchanges=("SSE", "SHSE", "XSHG", "SZSE", "XSHE", "BJSE", "XBSE", "XBEI"),
            primary_benchmark_symbol="000300.SS",
            benchmark_fallback_symbol="000001.SS",
            benchmark_primary_kind="index",
            benchmark_fallback_kind="index",
        ),
        MarketProfile(
            market=Market("CA"),
            label="Canada",
            currency="CAD",
            timezone_name="America/Toronto",
            calendar_id="XTSE",
            provider_calendar_id=None,
            exchanges=("TSX", "TSXV", "XTSE", "XTNX"),
            primary_benchmark_symbol="^GSPTSE",
            benchmark_fallback_symbol="XIU.TO",
            benchmark_primary_kind="index",
            benchmark_fallback_kind="etf",
        ),
        MarketProfile(
            market=Market("DE"),
            label="Germany",
            currency="EUR",
            timezone_name="Europe/Berlin",
            calendar_id="XETR",
            provider_calendar_id=None,
            exchanges=("XETR", "XETRA", "XFRA", "FRA", "FWB"),
            primary_benchmark_symbol="^GDAXI",
            benchmark_fallback_symbol="EXS1.DE",
            benchmark_primary_kind="index",
            benchmark_fallback_kind="etf",
        ),
        MarketProfile(
            market=Market("SG"),
            label="Singapore",
            currency="SGD",
            timezone_name="Asia/Singapore",
            calendar_id="XSES",
            provider_calendar_id=None,
            exchanges=("SGX", "SES", "XSES"),
            primary_benchmark_symbol="^STI",
            benchmark_fallback_symbol="ES3.SI",
            benchmark_primary_kind="index",
            benchmark_fallback_kind="etf",
        ),
    )
)
