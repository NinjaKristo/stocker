"""
Tests for response compression (GZipMiddleware).

Large JSON payloads (scan results, group rankings) must ship gzip-compressed
when the client advertises support; tiny payloads stay uncompressed.

These run against the real app because the middleware ORDER is the contract
under test: GZip must sit inside the BaseHTTPMiddleware (which re-streams
responses without Content-Length), or minimum_size is silently defeated.
"""
import pytest
import pytest_asyncio
import httpx

from app.main import app

_LARGE_PAYLOAD = {"rows": [{"symbol": f"SYM{i}", "value": i * 1.5} for i in range(500)]}


@pytest_asyncio.fixture
async def client():
    # Mount a large-response probe route for the duration of the test only,
    # so the shared app object is not left mutated for the rest of the suite.
    async def _large_response():
        return _LARGE_PAYLOAD

    app.add_api_route("/_test/large-response", _large_response, include_in_schema=False)
    probe_route = app.router.routes[-1]
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    finally:
        app.router.routes.remove(probe_route)


@pytest.mark.asyncio
class TestGzipCompression:
    async def test_large_response_is_gzipped(self, client):
        response = await client.get(
            "/_test/large-response", headers={"Accept-Encoding": "gzip"}
        )
        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"
        # httpx transparently decompresses; body must round-trip intact
        assert response.json() == _LARGE_PAYLOAD

    async def test_small_response_not_gzipped(self, client):
        response = await client.get("/livez", headers={"Accept-Encoding": "gzip"})
        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None

    async def test_no_accept_encoding_returns_identity(self, client):
        response = await client.get(
            "/_test/large-response", headers={"Accept-Encoding": "identity"}
        )
        assert response.status_code == 200
        assert response.headers.get("content-encoding") is None
        assert response.json() == _LARGE_PAYLOAD
