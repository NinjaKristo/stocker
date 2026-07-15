"""Celery tasks for paper-trading evaluation (tasks.md #7.4).

Beat runs this once per market on weekdays, an hour after that market's daily
cache-warm pipeline, so rules see the fully refreshed bars. The evaluation is
catch-up safe and idempotent — a missed or repeated run cannot double-enter.
"""

import logging

from app.celery_app import celery_app
from app.database import SessionLocal
from app.services.backplay.paper import evaluate_active_setups

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.paper_trading_tasks.evaluate_paper_setups")
def evaluate_paper_setups(market: str | None = None):
    """Evaluate all active paper setups against the latest cached bars."""
    db = SessionLocal()
    try:
        summary = evaluate_active_setups(db, market=market)
        logger.info(
            "Paper evaluation (market=%s): %s setups, %s opened, %s closed",
            market or "all",
            summary["setups_evaluated"],
            summary["opened"],
            summary["closed"],
        )
        return summary
    finally:
        db.close()
