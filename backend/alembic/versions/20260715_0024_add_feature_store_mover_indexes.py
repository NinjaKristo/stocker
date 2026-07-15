"""Index feature-store volume fields used by mover presets.

Revision ID: 20260715_0024
Revises: 20260705_0023
"""

from __future__ import annotations

from alembic import op

revision = "20260715_0024"
down_revision = "20260705_0023"
branch_labels = None
depends_on = None

_INDEXED_FIELDS = {
    "avg_dollar_volume": "volume",
    "volume_surge": "volume_surge",
}


def _index_name(field: str) -> str:
    return f"ix_sfd_run_{field}"


def _index_expr(field: str) -> str:
    return f"CAST(details_json ->> '{field}' AS FLOAT)"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    for field in _INDEXED_FIELDS:
        op.execute(
            f"CREATE INDEX IF NOT EXISTS {_index_name(field)} "
            f"ON stock_feature_daily (run_id, ({_index_expr(field)}))"
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    for field in _INDEXED_FIELDS:
        op.execute(f"DROP INDEX IF EXISTS {_index_name(field)}")
