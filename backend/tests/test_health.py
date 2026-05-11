"""
4-case test suite for GET /api/v1/health (feature 1.2).
DB connection is mocked — no live MongoDB required.
"""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def client():
    """ASGI test client with DB lifecycle mocked out."""
    with (
        patch("app.database.connect_db", new_callable=AsyncMock),
        patch("app.database.close_db", new_callable=AsyncMock),
        patch("app.database.create_indexes", new_callable=AsyncMock),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            yield c


# ── Case 1 — Happy Path ───────────────────────────────────────────────────────

async def test_health_happy_path(client: AsyncClient):
    r = await client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["message"] == "API is healthy"
    assert "env" in body["data"]
    assert "version" in body["data"]


# ── Case 2 — Edge / Boundary ──────────────────────────────────────────────────

async def test_health_ignores_extra_query_params(client: AsyncClient):
    """Health endpoint must still return 200 with arbitrary query params."""
    r = await client.get("/api/v1/health?foo=bar&page=99")
    assert r.status_code == 200
    assert r.json()["success"] is True


# ── Case 3 — Error / Invalid Input ───────────────────────────────────────────

async def test_health_wrong_method_returns_405(client: AsyncClient):
    """POST to a GET-only endpoint must return 405 Method Not Allowed."""
    r = await client.post("/api/v1/health")
    assert r.status_code == 405


async def test_health_nonexistent_route_returns_404(client: AsyncClient):
    """A totally unknown route must return 404."""
    r = await client.get("/api/v1/nonexistent")
    assert r.status_code == 404


# ── Case 4 — Response contract ───────────────────────────────────────────────

async def test_health_response_matches_success_response_contract(client: AsyncClient):
    """
    success_response() contract: body must have exactly
    {"success": True, "message": str, "data": ...}.
    """
    r = await client.get("/api/v1/health")
    body = r.json()
    assert set(body.keys()) == {"success", "message", "data"}
    assert isinstance(body["success"], bool)
    assert isinstance(body["message"], str)
