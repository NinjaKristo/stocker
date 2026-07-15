from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.price_refresh_activity import (
    PriceRefreshActivityDependencies,
    PriceRefreshActivityReporter,
)


def test_publish_progress_skips_celery_state_without_task_id() -> None:
    dependencies = PriceRefreshActivityDependencies(
        record_market_refresh_success=MagicMock(),
        mark_market_activity_started=MagicMock(),
        mark_market_activity_completed=MagicMock(),
        mark_market_activity_progress_safely=MagicMock(),
        mark_market_activity_failed_safely=MagicMock(),
    )
    reporter = PriceRefreshActivityReporter(dependencies)
    task = SimpleNamespace(
        name="smart_refresh_cache",
        request=SimpleNamespace(id=None),
        update_state=MagicMock(),
    )
    price_cache = MagicMock()

    reporter.publish_progress(
        MagicMock(),
        price_cache,
        task=task,
        market="US",
        effective_market="US",
        lifecycle="manual",
        current=1,
        total=2,
        percent=50.0,
        message="Refreshing market prices",
        refreshed=1,
        failed=0,
    )

    task.update_state.assert_not_called()
    price_cache.update_warmup_heartbeat.assert_called_once_with(
        1,
        2,
        50.0,
        market="US",
    )
    dependencies.mark_market_activity_progress_safely.assert_called_once()
