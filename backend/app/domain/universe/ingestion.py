"""Shared canonical row models for official-source Universe ingestion."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from ..markets.catalog import get_market_catalog
from .listing_tiers import listing_tier_registry


ACTIVE_UNIVERSE_STATUS = "active"


@dataclass(frozen=True, slots=True)
class UniverseLifecycleMetadata:
    """Mutable-row lifecycle state that maps to StockUniverse hot-path fields."""

    status: str = ACTIVE_UNIVERSE_STATUS
    is_active: bool = True
    status_reason: str | None = None
    first_seen_at: Any | None = None
    last_seen_in_source_at: Any | None = None
    deactivated_at: Any | None = None
    consecutive_fetch_failures: int = 0

    def __post_init__(self) -> None:
        status = _required_text(self.status, "status").lower()
        reason = _optional_text(self.status_reason)
        failures = int(self.consecutive_fetch_failures or 0)
        if failures < 0:
            raise ValueError("consecutive_fetch_failures must be non-negative")
        if status == ACTIVE_UNIVERSE_STATUS and not self.is_active:
            raise ValueError("active status requires is_active=True")
        if status != ACTIVE_UNIVERSE_STATUS and self.is_active:
            raise ValueError("inactive status requires is_active=False")
        if self.is_active and self.deactivated_at is not None:
            raise ValueError("active lifecycle metadata must not set deactivated_at")

        object.__setattr__(self, "status", status)
        object.__setattr__(self, "status_reason", reason)
        object.__setattr__(self, "consecutive_fetch_failures", failures)

    @classmethod
    def active(cls) -> "UniverseLifecycleMetadata":
        return cls(status=ACTIVE_UNIVERSE_STATUS, is_active=True)

    @classmethod
    def inactive(
        cls,
        *,
        status: str,
        reason: str | None = None,
        deactivated_at: Any | None = None,
    ) -> "UniverseLifecycleMetadata":
        normalized_status = _required_text(status, "status").lower()
        if normalized_status == ACTIVE_UNIVERSE_STATUS:
            raise ValueError("inactive lifecycle metadata requires a non-active status")
        return cls(
            status=normalized_status,
            is_active=False,
            status_reason=reason,
            deactivated_at=deactivated_at,
        )


@dataclass(frozen=True, slots=True)
class UniverseSourceProvenance:
    """Source lineage for one canonical Universe row."""

    source_name: str
    snapshot_id: str
    source_symbol: str = ""
    source_row_number: int | None = None
    snapshot_as_of: Any | None = None
    source_metadata: Mapping[str, Any] = field(default_factory=dict)
    lineage_hash: str | None = None
    row_hash: str | None = None

    def __post_init__(self) -> None:
        source_name = _required_text(self.source_name, "source_name").lower()
        source_name = source_name.replace("-", "_")
        snapshot_id = _required_text(self.snapshot_id, "snapshot_id")
        source_symbol = _optional_text(self.source_symbol) or ""
        row_number = self.source_row_number
        if row_number is not None:
            row_number = int(row_number)
            if row_number <= 0:
                raise ValueError("source_row_number must be positive when provided")

        object.__setattr__(self, "source_name", source_name)
        object.__setattr__(self, "source_symbol", source_symbol)
        object.__setattr__(self, "source_row_number", row_number)
        object.__setattr__(self, "snapshot_id", snapshot_id)
        object.__setattr__(self, "source_metadata", dict(self.source_metadata or {}))
        object.__setattr__(self, "lineage_hash", _optional_text(self.lineage_hash))
        object.__setattr__(self, "row_hash", _optional_text(self.row_hash))


@dataclass(frozen=True, slots=True)
class CanonicalUniverseRow:
    """Canonical official-source Universe row before persistence."""

    symbol: str
    name: str
    market: str
    mic: str
    local_code: str
    currency: str | None
    timezone: str | None
    provenance: UniverseSourceProvenance
    listing_tier: str | None = None
    sector: str = ""
    industry: str = ""
    market_cap: float | None = None
    lifecycle: UniverseLifecycleMetadata = field(
        default_factory=UniverseLifecycleMetadata.active
    )

    def __post_init__(self) -> None:
        symbol = _required_text(self.symbol, "symbol").upper()
        market = _required_text(self.market, "market").upper()
        mic = _required_text(self.mic, "mic").upper()
        local_code = _required_text(self.local_code, "local_code").upper()

        market_entry = get_market_catalog().get(market)
        if mic not in market_entry.mics:
            supported = ", ".join(market_entry.mics)
            raise ValueError(
                f"Unsupported MIC {mic!r} for market {market}. Supported: {supported}"
            )

        mic_facts = market_entry.mic_facts_for(mic)
        currency = _optional_text(self.currency)
        currency = currency.upper() if currency else mic_facts.default_currency
        if currency not in market_entry.supported_currencies:
            supported = ", ".join(market_entry.supported_currencies)
            raise ValueError(
                f"Unsupported currency {currency!r} for market {market}. "
                f"Supported: {supported}"
            )

        timezone = _optional_text(self.timezone) or mic_facts.timezone
        listing_tier = self._normalize_listing_tier(market, mic, self.listing_tier)
        market_cap = float(self.market_cap) if self.market_cap is not None else None

        object.__setattr__(self, "symbol", symbol)
        object.__setattr__(self, "name", _optional_text(self.name) or "")
        object.__setattr__(self, "market", market)
        object.__setattr__(self, "mic", mic)
        object.__setattr__(self, "local_code", local_code)
        object.__setattr__(self, "currency", currency)
        object.__setattr__(self, "timezone", timezone)
        object.__setattr__(self, "listing_tier", listing_tier)
        object.__setattr__(self, "sector", _optional_text(self.sector) or "")
        object.__setattr__(self, "industry", _optional_text(self.industry) or "")
        object.__setattr__(self, "market_cap", market_cap)

    @property
    def active_identity_key(self) -> tuple[str, str, str] | None:
        if not self.lifecycle.is_active:
            return None
        return (self.market, self.mic, self.local_code)

    @property
    def is_active(self) -> bool:
        return self.lifecycle.is_active

    @property
    def source_name(self) -> str:
        return self.provenance.source_name

    @property
    def source_symbol(self) -> str:
        return self.provenance.source_symbol

    @property
    def source_row_number(self) -> int | None:
        return self.provenance.source_row_number

    @property
    def snapshot_id(self) -> str:
        return self.provenance.snapshot_id

    @property
    def snapshot_as_of(self) -> Any | None:
        return self.provenance.snapshot_as_of

    @property
    def source_metadata(self) -> Mapping[str, Any]:
        return self.provenance.source_metadata

    @property
    def lineage_hash(self) -> str | None:
        return self.provenance.lineage_hash

    @property
    def row_hash(self) -> str | None:
        return self.provenance.row_hash

    @staticmethod
    def _normalize_listing_tier(
        market: str,
        mic: str,
        listing_tier: str | None,
    ) -> str | None:
        raw_tier = _optional_text(listing_tier)
        if raw_tier is None:
            return None
        normalized_tier = listing_tier_registry.normalize(
            market,
            raw_tier,
            mic=mic,
        )
        if normalized_tier is None:
            raise ValueError(
                f"Unsupported listing_tier {listing_tier!r} for {market}/{mic}"
            )
        return normalized_tier


@dataclass(frozen=True, slots=True)
class RejectedUniverseRow:
    """Rejected source row captured by canonicalization or ingestion."""

    source_row_number: int | None
    source_symbol: str
    reason: str
    source_name: str | None = None
    snapshot_id: str | None = None

    def __post_init__(self) -> None:
        row_number = self.source_row_number
        if row_number is not None:
            row_number = int(row_number)
            if row_number <= 0:
                raise ValueError("source_row_number must be positive when provided")

        object.__setattr__(self, "source_row_number", row_number)
        object.__setattr__(self, "source_symbol", _optional_text(self.source_symbol) or "")
        object.__setattr__(self, "reason", _required_text(self.reason, "reason"))
        object.__setattr__(self, "source_name", _optional_text(self.source_name))
        object.__setattr__(self, "snapshot_id", _optional_text(self.snapshot_id))


class DuplicateActiveUniverseRowError(ValueError):
    """Raised when active rows collide on canonical Market/MIC/local_code."""

    def __init__(
        self,
        identity_key: tuple[str, str, str],
        first: CanonicalUniverseRow,
        second: CanonicalUniverseRow,
    ) -> None:
        self.identity_key = identity_key
        self.symbols = (first.symbol, second.symbol)
        market, mic, local_code = identity_key
        super().__init__(
            "Duplicate active Universe identity "
            f"{market}/{mic}/{local_code} for symbols "
            f"{first.symbol!r} and {second.symbol!r}"
        )


@dataclass(frozen=True, slots=True)
class CanonicalUniverseIngestionResult:
    """Canonical ingestion output with active identity invariants enforced."""

    canonical_rows: tuple[CanonicalUniverseRow, ...] = ()
    rejected_rows: tuple[RejectedUniverseRow, ...] = ()

    def __post_init__(self) -> None:
        canonical_rows = tuple(self.canonical_rows or ())
        rejected_rows = tuple(self.rejected_rows or ())

        seen: dict[tuple[str, str, str], CanonicalUniverseRow] = {}
        for row in canonical_rows:
            key = row.active_identity_key
            if key is None:
                continue
            previous = seen.get(key)
            if previous is not None:
                raise DuplicateActiveUniverseRowError(key, previous, row)
            seen[key] = row

        object.__setattr__(self, "canonical_rows", canonical_rows)
        object.__setattr__(self, "rejected_rows", rejected_rows)

    @property
    def rows(self) -> tuple[CanonicalUniverseRow, ...]:
        return self.canonical_rows

    @property
    def accepted_count(self) -> int:
        return len(self.canonical_rows)

    @property
    def rejected_count(self) -> int:
        return len(self.rejected_rows)


def _required_text(value: str | None, field_name: str) -> str:
    normalized = _optional_text(value)
    if normalized is None:
        raise ValueError(f"{field_name} must be provided")
    return normalized


def _optional_text(value: Any | None) -> str | None:
    normalized = str(value or "").strip()
    return normalized or None
