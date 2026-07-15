"""Add Backplay backtest and paper-trading tables.

Four additive tables (tasks.md #7):

- ``backplay_strategies`` — saved trading rules (built-in or script)
- ``backplay_runs``       — completed backtests with inputs + results
- ``paper_setups``        — ongoing paper-trading experiments
- ``paper_trades``        — simulated trades with an event timeline
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260705_0023"
down_revision = "20260618_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    json_type = postgresql.JSONB if bind.dialect.name == "postgresql" else sa.JSON

    op.create_table(
        "backplay_strategies",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("description", sa.Text),
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="script"),
        sa.Column("builtin_id", sa.String(length=32)),
        sa.Column("params", json_type()),
        sa.Column("entry_script", sa.Text),
        sa.Column("exit_script", sa.Text),
        sa.Column("stop_loss_pct", sa.Float),
        sa.Column("take_profit_pct", sa.Float),
        sa.Column("max_hold_days", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_backplay_strategies_name", "backplay_strategies", ["name"])

    op.create_table(
        "backplay_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="completed"),
        sa.Column("symbol", sa.String(length=20)),
        sa.Column("preset_key", sa.String(length=64)),
        sa.Column("preset_name", sa.String(length=100)),
        sa.Column("start_date", sa.Date),
        sa.Column("end_date", sa.Date),
        sa.Column("strategy_json", json_type()),
        sa.Column("results_json", json_type()),
        sa.Column("error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_backplay_runs_created", "backplay_runs", ["created_at"])
    op.create_index("idx_backplay_runs_symbol", "backplay_runs", ["symbol"])

    op.create_table(
        "paper_setups",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("source_kind", sa.String(length=16), nullable=False, server_default="symbol"),
        sa.Column("symbol", sa.String(length=20)),
        sa.Column("preset_key", sa.String(length=64)),
        sa.Column("top_n", sa.Integer, nullable=False, server_default="10"),
        sa.Column("market", sa.String(length=8), nullable=False, server_default="US"),
        sa.Column("strategy_json", json_type(), nullable=False),
        sa.Column("position_size", sa.Float, nullable=False, server_default="10000"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("stopped_at", sa.DateTime(timezone=True)),
        sa.Column("last_evaluated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_paper_setups_status", "paper_setups", ["status"])

    op.create_table(
        "paper_trades",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "setup_id",
            sa.Integer,
            sa.ForeignKey("paper_setups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column("entry_date", sa.Date),
        sa.Column("entry_price", sa.Float),
        sa.Column("shares", sa.Float),
        sa.Column("exit_date", sa.Date),
        sa.Column("exit_price", sa.Float),
        sa.Column("return_pct", sa.Float),
        sa.Column("exit_reason", sa.String(length=32)),
        sa.Column("events_json", json_type()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_paper_trades_setup", "paper_trades", ["setup_id"])
    op.create_index("idx_paper_trades_status", "paper_trades", ["status"])
    op.create_index("idx_paper_trades_symbol", "paper_trades", ["symbol"])


def downgrade() -> None:
    op.drop_index("idx_paper_trades_symbol", table_name="paper_trades")
    op.drop_index("idx_paper_trades_status", table_name="paper_trades")
    op.drop_index("idx_paper_trades_setup", table_name="paper_trades")
    op.drop_table("paper_trades")
    op.drop_index("idx_paper_setups_status", table_name="paper_setups")
    op.drop_table("paper_setups")
    op.drop_index("idx_backplay_runs_symbol", table_name="backplay_runs")
    op.drop_index("idx_backplay_runs_created", table_name="backplay_runs")
    op.drop_table("backplay_runs")
    op.drop_index("idx_backplay_strategies_name", table_name="backplay_strategies")
    op.drop_table("backplay_strategies")
