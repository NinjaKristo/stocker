"""Scan-preset stock selection for Backplay mode 2 ("Scan Top 10").

Resolves a preset key (``builtin:<id>`` from PRESET_SCREENS or
``custom:<filter_preset_id>`` from the user's saved presets), applies its
filters to the latest published feature-store rows, and returns the top N by
the preset's own sort field.

Known simplification, stated in the UI: stocks are chosen by *today's* scan
and then tested backwards — this answers "does my rule work on the kind of
stock this scan finds", not a point-in-time simulation.
"""

from __future__ import annotations

import heapq
import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.filter_preset import FilterPreset
from app.services.preset_screens import PRESET_SCREENS, _matches_preset_filters

__all__ = ["pick_top", "resolve_preset", "list_presets", "load_latest_serialized_rows", "select_top_symbols"]


def resolve_preset(db: Session, preset_key: str) -> dict[str, Any]:
    """Return {name, filters, sort_by, sort_order} for a preset key."""
    kind, _, ref = (preset_key or "").partition(":")

    if kind == "builtin" and ref:
        for screen in PRESET_SCREENS:
            if screen["id"] == ref:
                return {
                    "name": screen["name"],
                    "filters": screen.get("filters") or {},
                    "sort_by": screen.get("sort_by", "composite_score"),
                    "sort_order": screen.get("sort_order", "desc"),
                }
        known = ", ".join(screen["id"] for screen in PRESET_SCREENS)
        raise ValueError(f"Unknown built-in preset '{ref}' (available: {known})")

    if kind == "custom" and ref:
        try:
            preset_id = int(ref)
        except ValueError:
            raise ValueError(f"Invalid preset key '{preset_key}'")
        preset = db.query(FilterPreset).filter(FilterPreset.id == preset_id).first()
        if preset is None:
            raise ValueError(f"Saved preset {preset_id} not found")
        try:
            filters = json.loads(preset.filters) if isinstance(preset.filters, str) else (preset.filters or {})
        except json.JSONDecodeError:
            filters = {}
        return {
            "name": preset.name,
            "filters": filters,
            "sort_by": preset.sort_by or "composite_score",
            "sort_order": preset.sort_order or "desc",
        }

    raise ValueError(
        f"Invalid preset key '{preset_key}' — expected 'builtin:<id>' or 'custom:<id>'"
    )


def list_presets(db: Session) -> list[dict[str, Any]]:
    """Merged preset catalog for the Backplay UI: built-ins first, then saved."""
    catalog = [
        {
            "key": f"builtin:{screen['id']}",
            "name": screen["name"],
            "description": screen.get("description"),
            "source": "builtin",
        }
        for screen in PRESET_SCREENS
    ]
    for preset in db.query(FilterPreset).order_by(FilterPreset.position).all():
        catalog.append(
            {
                "key": f"custom:{preset.id}",
                "name": preset.name,
                "description": preset.description,
                "source": "custom",
            }
        )
    return catalog


def pick_top(rows: list[dict], preset: dict[str, Any], top_n: int = 10) -> list[dict]:
    """Filter serialized scan rows by the preset and return the top N ranked rows."""
    filters = preset.get("filters") or {}
    matching = [row for row in rows if _matches_preset_filters(row, filters)]

    sort_field = preset.get("sort_by", "composite_score")
    descending = preset.get("sort_order", "desc") == "desc"

    def sort_key(row):
        value = row.get(sort_field)
        if value is None:
            return (0, 0)
        return (1, value if descending else -value)

    return heapq.nlargest(top_n, matching, key=sort_key)


def load_latest_serialized_rows(db: Session, market: str | None = None) -> tuple[dict[str, Any], list[dict]]:
    """Load the latest published feature run's rows as flat serialized dicts.

    Returns (run_info, rows). Raises ValueError when nothing is published yet.
    """
    from app.domain.scanning.filter_spec import FilterSpec, SortOrder, SortSpec
    from app.infra.db.models.feature_store import FeatureRun, FeatureRunPointer
    from app.infra.db.repositories.feature_store_repository import SqlFeatureStoreRepository
    from app.schemas.scanning import ScanResultItem

    normalized_market = market.upper() if market else None
    pointer_key = (
        f"latest_published_market:{normalized_market}" if normalized_market else "latest_published"
    )
    run = None
    pointer = db.query(FeatureRunPointer).filter(FeatureRunPointer.key == pointer_key).first()
    if pointer is not None:
        candidate = db.query(FeatureRun).filter(FeatureRun.id == pointer.run_id).first()
        if candidate is not None and candidate.status == "published":
            run = candidate
    if run is None:
        run = (
            db.query(FeatureRun)
            .filter(FeatureRun.status == "published")
            .order_by(FeatureRun.published_at.desc(), FeatureRun.id.desc())
            .first()
        )
    if run is None:
        raise ValueError("No published scan data yet — run the daily pipeline first")

    repo = SqlFeatureStoreRepository(db)
    domain_rows = repo.query_all_as_scan_results(
        run.id,
        FilterSpec(),
        SortSpec(field="composite_score", order=SortOrder.DESC),
        include_sparklines=False,
    )

    serialized: list[dict] = []
    for domain_row in domain_rows:
        item = ScanResultItem.from_domain(domain_row, include_setup_payload=False).model_dump(mode="json")
        extended = getattr(domain_row, "extended_fields", None) or {}
        for key, value in extended.items():
            item.setdefault(key, value)
        serialized.append(item)

    run_info = {"run_id": run.id, "as_of_date": run.as_of_date.isoformat()}
    return run_info, serialized


def select_top_symbols(
    db: Session,
    preset_key: str,
    top_n: int = 10,
    market: str | None = None,
) -> dict[str, Any]:
    """End-to-end mode-2 selection: preset key → run info + top rows."""
    preset = resolve_preset(db, preset_key)
    run_info, rows = load_latest_serialized_rows(db, market=market)
    picks = pick_top(rows, preset, top_n=top_n)
    return {
        "preset_name": preset["name"],
        "run": run_info,
        "picks": [
            {
                "symbol": row.get("symbol"),
                "company_name": row.get("company_name"),
                "composite_score": row.get("composite_score"),
                "sort_value": row.get(preset.get("sort_by", "composite_score")),
            }
            for row in picks
        ],
    }
