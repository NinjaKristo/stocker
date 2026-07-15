"""Keep mover-preset index expressions aligned with runtime filters."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from sqlalchemy.dialects import postgresql

from app.infra.db.models.feature_store import StockFeatureDaily
from app.infra.db.portability import json_number
from app.infra.query.feature_store_query import _JSON_FIELD_MAP

_MIGRATION = (
    Path(__file__).parents[2]
    / "alembic"
    / "versions"
    / "20260715_0024_add_feature_store_mover_indexes.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("_mover_index_migration", _MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _builder_expr(field: str) -> str:
    path = _JSON_FIELD_MAP[field]
    compiled = str(
        json_number(StockFeatureDaily.details_json, path).compile(
            dialect=postgresql.dialect(),
        )
    )
    return compiled.replace("stock_feature_daily.", "")


def test_mover_indexes_match_runtime_json_expressions() -> None:
    migration = _load_migration()

    for json_field, domain_field in migration._INDEXED_FIELDS.items():
        assert _JSON_FIELD_MAP[domain_field] == (json_field,)
        assert migration._index_expr(json_field) == _builder_expr(domain_field)
