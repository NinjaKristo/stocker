"""Explainable peer screens for Backplay similar-stock discovery."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class Dimension:
    field: str
    label: str
    weight: float
    scale: float | None = None
    transform: Callable[[float], float] | None = None


def _log10(value: float) -> float:
    return math.log10(max(value, 1.0))


SCREEN_DEFINITIONS: tuple[dict[str, Any], ...] = (
    {
        "id": "technical_twins",
        "name": "Technical Twins",
        "description": "Stocks with similar leadership, volatility, trend stage, and setup quality.",
        "dimensions": (
            Dimension("rs_rating", "RS", 1.4, 100),
            Dimension("composite_score", "Composite score", 1.1, 100),
            Dimension("adr_percent", "ADR", 0.8, 8),
            Dimension("beta", "Beta", 0.5, 2),
            Dimension("stage", "Stage", 0.8),
            Dimension("se_setup_score", "SE score", 0.8, 100),
            Dimension("se_distance_to_pivot_pct", "Pivot distance", 0.6, 20),
        ),
    },
    {
        "id": "growth_peers",
        "name": "Growth Peers",
        "description": "Companies with comparable earnings, sales growth, quality, size, and strength.",
        "dimensions": (
            Dimension("eps_growth_qq", "EPS growth", 1.1, 100),
            Dimension("sales_growth_qq", "Sales growth", 1.0, 100),
            Dimension("eps_rating", "EPS rating", 1.0, 100),
            Dimension("market_cap_usd", "Market cap", 0.8, 2.5, _log10),
            Dimension("rs_rating", "RS", 0.8, 100),
            Dimension("gics_sector", "GICS sector", 0.7),
        ),
    },
    {
        "id": "group_leaders",
        "name": "Group Leaders",
        "description": "Leadership candidates in the same industry or sector with similar rank and score.",
        "required_any_match": ("ibd_industry_group", "gics_industry", "gics_sector"),
        "dimensions": (
            Dimension("ibd_industry_group", "IBD group", 1.8),
            Dimension("gics_industry", "GICS industry", 1.2),
            Dimension("gics_sector", "GICS sector", 0.8),
            Dimension("ibd_group_rank", "IBD group rank", 0.8, 197),
            Dimension("rs_rating", "RS", 1.1, 100),
            Dimension("composite_score", "Composite score", 0.8, 100),
        ),
    },
)


def _usable_number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _dimension_score(target: dict, candidate: dict, dimension: Dimension) -> tuple[float, str] | None:
    target_value = target.get(dimension.field)
    candidate_value = candidate.get(dimension.field)
    if target_value is None or candidate_value is None:
        return None

    if dimension.scale is None:
        score = 1.0 if str(target_value).casefold() == str(candidate_value).casefold() else 0.0
        detail = f"{dimension.label}: {candidate_value}"
        return score, detail

    target_number = _usable_number(target_value)
    candidate_number = _usable_number(candidate_value)
    if target_number is None or candidate_number is None:
        return None
    display_target = target_number
    display_candidate = candidate_number
    if dimension.transform is not None:
        target_number = dimension.transform(target_number)
        candidate_number = dimension.transform(candidate_number)
    score = max(0.0, 1.0 - abs(target_number - candidate_number) / dimension.scale)
    detail = f"{dimension.label}: {display_candidate:g} vs {display_target:g}"
    return score, detail


def _score_candidate(target: dict, candidate: dict, dimensions: tuple[Dimension, ...]) -> dict | None:
    comparisons: list[tuple[float, float, str]] = []
    for dimension in dimensions:
        result = _dimension_score(target, candidate, dimension)
        if result is None:
            continue
        score, detail = result
        comparisons.append((score, dimension.weight, detail))

    if len(comparisons) < 2:
        return None
    total_weight = sum(weight for _, weight, _ in comparisons)
    similarity = sum(score * weight for score, weight, _ in comparisons) / total_weight
    strongest = sorted(comparisons, key=lambda item: (item[0], item[1]), reverse=True)[:3]
    return {
        "symbol": candidate.get("symbol"),
        "company_name": candidate.get("company_name"),
        "similarity": round(similarity * 100, 1),
        "matched_dimensions": len(comparisons),
        "evidence": [detail for _, _, detail in strongest],
        "snapshot": {
            "rs_rating": candidate.get("rs_rating"),
            "composite_score": candidate.get("composite_score"),
            "eps_growth_qq": candidate.get("eps_growth_qq"),
            "sales_growth_qq": candidate.get("sales_growth_qq"),
            "ibd_industry_group": candidate.get("ibd_industry_group"),
            "gics_sector": candidate.get("gics_sector"),
        },
    }


def generate_peer_screens(rows: list[dict], symbol: str, limit: int = 5) -> dict[str, Any]:
    """Generate ranked peer candidates for each explainable screen definition."""
    normalized_symbol = symbol.strip().upper()
    target = next(
        (row for row in rows if str(row.get("symbol") or "").upper() == normalized_symbol),
        None,
    )
    if target is None:
        raise ValueError(f"{normalized_symbol} is not present in the latest published scan")

    strategies: list[dict[str, Any]] = []
    for definition in SCREEN_DEFINITIONS:
        candidates = []
        for row in rows:
            candidate_symbol = str(row.get("symbol") or "").upper()
            if not candidate_symbol or candidate_symbol == normalized_symbol:
                continue
            required_fields = definition.get("required_any_match") or ()
            if required_fields and not any(
                target.get(field) is not None
                and row.get(field) is not None
                and str(target[field]).casefold() == str(row[field]).casefold()
                for field in required_fields
            ):
                continue
            scored = _score_candidate(target, row, definition["dimensions"])
            if scored is not None:
                candidates.append(scored)
        candidates.sort(
            key=lambda item: (
                item["similarity"],
                _usable_number(item["snapshot"].get("composite_score")) or -1,
                item["symbol"],
            ),
            reverse=True,
        )
        strategies.append(
            {
                "id": definition["id"],
                "name": definition["name"],
                "description": definition["description"],
                "dimensions": [dimension.label for dimension in definition["dimensions"]],
                "candidates": candidates[:limit],
            }
        )

    return {
        "symbol": normalized_symbol,
        "company_name": target.get("company_name"),
        "target_snapshot": {
            "rs_rating": target.get("rs_rating"),
            "composite_score": target.get("composite_score"),
            "eps_growth_qq": target.get("eps_growth_qq"),
            "sales_growth_qq": target.get("sales_growth_qq"),
            "ibd_industry_group": target.get("ibd_industry_group"),
            "gics_sector": target.get("gics_sector"),
        },
        "strategies": strategies,
    }


__all__ = ["SCREEN_DEFINITIONS", "generate_peer_screens"]
