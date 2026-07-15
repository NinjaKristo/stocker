"""
Shared pytest fixtures for backend tests.

Provides database session fixtures, mock data, and common test configuration.
"""
import os
import pytest
import sys
from pathlib import Path

# Add backend directory to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# SQLAlchemy 2.0.25's optional C extension can segfault after thousands of
# repeated SQLite schema resets. Tests favor determinism over that optimization.
os.environ.setdefault("DISABLE_SQLALCHEMY_CEXT_RUNTIME", "1")

# Keep backend tests independent from a developer's local backend/.env and from
# CI job-level DATABASE_URL placeholders. Tests default to the shared SQLite
# harness unless a caller explicitly opts into using the supplied DATABASE_URL.
_allow_postgres = os.environ.get("STOCKSCANNER_TEST_ALLOW_POSTGRES") == "1"
_allow_postgres = _allow_postgres or (
    os.environ.get("STOCKSCANNER_TEST_USE_DATABASE_URL") == "1"
)

if _allow_postgres and os.environ.get("DATABASE_URL"):
    os.environ.pop("STOCKSCANNER_TEST_ALLOW_SQLITE", None)
else:
    os.environ["DATABASE_URL"] = "sqlite://"
    os.environ["STOCKSCANNER_TEST_ALLOW_SQLITE"] = "1"

# A developer's root .env may enable shared-server authentication. API tests
# start unauthenticated unless a server-auth test explicitly enables it.
os.environ.setdefault("SERVER_AUTH_ENABLED", "false")

import app.models  # noqa: F401
from app.database import SessionLocal, engine, Base
from sqlalchemy import event


@event.listens_for(engine, "connect")
def _disable_sqlite_driver_transaction_management(dbapi_connection, _):
    """Let SQLAlchemy own SQLite transactions so savepoints remain valid."""
    if engine.dialect.name == "sqlite":
        dbapi_connection.isolation_level = None


@event.listens_for(engine, "begin")
def _begin_sqlite_transaction(connection):
    if engine.dialect.name == "sqlite":
        connection.exec_driver_sql("BEGIN")


@pytest.fixture(scope="session", autouse=True)
def shared_test_schema():
    """Create the shared in-memory schema once for the test session."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(autouse=True)
def shared_test_database(shared_test_schema):
    """Isolate each test in an outer transaction.

    Sessions use savepoints so application-level commit/rollback calls retain
    their real semantics without leaking rows into the next test.
    """
    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal.configure(
        bind=connection,
        join_transaction_mode="create_savepoint",
    )
    try:
        yield
    finally:
        SessionLocal.configure(
            bind=engine,
            join_transaction_mode="conditional_savepoint",
        )
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def runtime_services_context():
    """Provide a fresh runtime container for each test."""
    from app.wiring.bootstrap import (
        build_runtime_services,
        clear_runtime_services,
        set_runtime_services,
    )

    runtime_services = build_runtime_services(session_factory=SessionLocal)
    set_runtime_services(runtime_services, bind_process=True)
    try:
        yield runtime_services
    finally:
        try:
            runtime_services.reset_for_tests()
        finally:
            clear_runtime_services()


@pytest.fixture(scope="function")
def db_session():
    """
    Provides a database session for tests.

    Uses the existing database connection - tests should not modify
    production data unless explicitly intended.
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="module")
def db_session_module():
    """
    Provides a database session scoped to the module level.

    More efficient for read-only tests that don't need isolation.
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_symbols():
    """Common test symbols - mix of growth stocks."""
    return ['AAPL', 'NVDA', 'MSFT']


@pytest.fixture
def single_test_symbol():
    """Single test symbol for quick tests."""
    return 'AAPL'


@pytest.fixture
def scan_orchestrator():
    """Provides a ScanOrchestrator instance wired with production dependencies."""
    from app.wiring.bootstrap import get_scan_orchestrator
    return get_scan_orchestrator()


@pytest.fixture
def screener_registry():
    """Provides access to the screener registry."""
    from app.scanners.screener_registry import screener_registry
    return screener_registry
