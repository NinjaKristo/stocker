"""History providers for Relative Rotation Graph inputs."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Protocol, Sequence, Tuple


RRGHistoryResult = Tuple[
    str | None,
    dict[str, dict[str, Any]],
    dict[str, list[tuple[date, float, int]]],
]


class RRGHistoryProvider(Protocol):
    """Source RRG-ready group-ranking history for one market."""

    def get_all_groups_history(
        self,
        db: Any,
        *,
        market: str,
        days: int,
    ) -> RRGHistoryResult:
        """Return latest date, current ranking metadata, and daily RS series."""


class USGroupRankHistoryProvider:
    """Read US RRG history from persisted IBD group-rank rows."""

    def __init__(self, group_rank_service: Any) -> None:
        self._group_rank_service = group_rank_service

    def get_all_groups_history(
        self,
        db: Any,
        *,
        market: str,
        days: int,
    ) -> RRGHistoryResult:
        from datetime import date as _date

        from app.models.industry import IBDGroupRank

        current = self._group_rank_service.get_current_rankings(
            db,
            limit=197,
            market=market,
        )
        if not current:
            return None, {}, {}

        latest_date = current[0]["date"]
        meta = {row["industry_group"]: row for row in current}
        cutoff = _date.fromisoformat(latest_date) - timedelta(days=days)
        rows = (
            db.query(
                IBDGroupRank.industry_group,
                IBDGroupRank.date,
                IBDGroupRank.avg_rs_rating,
                IBDGroupRank.num_stocks,
            )
            .filter(IBDGroupRank.market == market, IBDGroupRank.date >= cutoff)
            .order_by(IBDGroupRank.industry_group, IBDGroupRank.date)
            .all()
        )
        return latest_date, meta, _collect_group_series(rows)


class FeatureRunGroupRankHistoryProvider:
    """Read non-US RRG history from published feature-run group rankings."""

    def __init__(self, market_group_ranking_service: Any) -> None:
        self._market_group_ranking_service = market_group_ranking_service

    def get_all_groups_history(
        self,
        db: Any,
        *,
        market: str,
        days: int,
    ) -> RRGHistoryResult:
        return self._market_group_ranking_service.get_all_groups_history(
            db,
            market=market,
            days=days,
        )


class CompositeRRGHistoryProvider:
    """Dispatch to the market-appropriate RRG history provider."""

    def __init__(
        self,
        *,
        us_provider: RRGHistoryProvider,
        feature_run_provider: RRGHistoryProvider,
        us_market: str = "US",
    ) -> None:
        self._us_provider = us_provider
        self._feature_run_provider = feature_run_provider
        self._us_market = us_market

    def get_all_groups_history(
        self,
        db: Any,
        *,
        market: str,
        days: int,
    ) -> RRGHistoryResult:
        provider = (
            self._us_provider
            if str(market or "").upper() == self._us_market
            else self._feature_run_provider
        )
        return provider.get_all_groups_history(db, market=market, days=days)


def _collect_group_series(
    rows: Sequence[Tuple[str, date, float, int | None]],
) -> dict[str, list[tuple[date, float, int]]]:
    series: dict[str, list[tuple[date, float, int]]] = defaultdict(list)
    for group, d, rs, ns in rows:
        series[group].append((d, float(rs), int(ns or 0)))
    return dict(series)


__all__ = [
    "CompositeRRGHistoryProvider",
    "FeatureRunGroupRankHistoryProvider",
    "RRGHistoryProvider",
    "RRGHistoryResult",
    "USGroupRankHistoryProvider",
]
