"""
4-case test suite for features 2.1 & 2.2 — Connector model + CRUD endpoints.
DB mocked via dependency_overrides per mistakes.md convention.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import get_db
from app.middleware.auth import get_current_user

# ── Fixtures ──────────────────────────────────────────────────────────────────

USER_OID = ObjectId()
ACTIVE_USER = {
    "_id": USER_OID,
    "email": "user@test.com",
    "name": "Test User",
    "role": "user",
    "plan": "free",
    "is_active": True,
}

CONNECTOR_OID = ObjectId()
CONNECTOR_DOC = {
    "_id": CONNECTOR_OID,
    "user_id": str(USER_OID),
    "platform": "google_ads",
    "name": "My Google Ads",
    "status": "disconnected",
    "sync_frequency": "daily",
    "encrypted_access_token": None,
    "encrypted_refresh_token": None,
    "token_expires_at": None,
    "last_synced_at": None,
    "error_message": None,
    "platform_account_id": None,
    "created_at": __import__("datetime").datetime(2026, 5, 5, 10, 0, 0),
    "updated_at": __import__("datetime").datetime(2026, 5, 5, 10, 0, 0),
}


def _user_override(user: dict):
    async def _dep():
        return user
    return _dep


def _db_with_connector(connector=CONNECTOR_DOC, insert_oid=None):
    col = MagicMock()
    col.find_one = AsyncMock(return_value=connector)
    ins = MagicMock()
    ins.inserted_id = insert_oid or CONNECTOR_OID
    col.insert_one = AsyncMock(return_value=ins)
    col.find_one_and_update = AsyncMock(return_value=connector)
    cursor = MagicMock()
    cursor.to_list = AsyncMock(return_value=[connector] if connector else [])
    col.find = MagicMock(return_value=cursor)
    cursor.sort = MagicMock(return_value=cursor)
    del_result = MagicMock()
    del_result.deleted_count = 1
    col.delete_one = AsyncMock(return_value=del_result)

    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=col)
    return db


@pytest.fixture(autouse=True)
def reset_overrides():
    yield
    app.dependency_overrides.clear()


# ── Happy path ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_connector_happy():
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    app.dependency_overrides[get_db] = lambda: _db_with_connector()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/connectors",
            json={"platform": "google_ads", "name": "My Google Ads", "sync_frequency": "daily"},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["platform"] == "google_ads"
    assert data["data"]["status"] == "disconnected"
    assert "encrypted_access_token" not in data["data"]


@pytest.mark.asyncio
async def test_list_connectors_happy():
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    app.dependency_overrides[get_db] = lambda: _db_with_connector()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/api/v1/connectors",
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)
    assert body["data"][0]["platform"] == "google_ads"


@pytest.mark.asyncio
async def test_get_connector_happy():
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    app.dependency_overrides[get_db] = lambda: _db_with_connector()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            f"/api/v1/connectors/{CONNECTOR_OID}",
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == str(CONNECTOR_OID)


@pytest.mark.asyncio
async def test_update_connector_happy():
    updated = {**CONNECTOR_DOC, "name": "Renamed", "sync_frequency": "hourly"}
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    app.dependency_overrides[get_db] = lambda: _db_with_connector(connector=updated)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.put(
            f"/api/v1/connectors/{CONNECTOR_OID}",
            json={"name": "Renamed", "sync_frequency": "hourly"},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["name"] == "Renamed"


@pytest.mark.asyncio
async def test_delete_connector_happy():
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    app.dependency_overrides[get_db] = lambda: _db_with_connector()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete(
            f"/api/v1/connectors/{CONNECTOR_OID}",
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 204


# ── Edge cases ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_connector_invalid_platform():
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    app.dependency_overrides[get_db] = lambda: _db_with_connector()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/connectors",
            json={"platform": "snapchat_ads", "name": "Snap", "sync_frequency": "daily"},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_connector_no_fields():
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    app.dependency_overrides[get_db] = lambda: _db_with_connector()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.put(
            f"/api/v1/connectors/{CONNECTOR_OID}",
            json={},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 400
    assert resp.json()["success"] is False


# ── Error cases ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_connector_not_found():
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    app.dependency_overrides[get_db] = lambda: _db_with_connector(connector=None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            f"/api/v1/connectors/{CONNECTOR_OID}",
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_connector_not_found():
    db = _db_with_connector()
    del_result = MagicMock()
    del_result.deleted_count = 0
    db["connectors"].delete_one = AsyncMock(return_value=del_result)

    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    app.dependency_overrides[get_db] = lambda: db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete(
            f"/api/v1/connectors/{CONNECTOR_OID}",
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 404


# ── Permission / security ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_connectors_unauthenticated():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/connectors")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_connector_not_owned_by_user():
    """Connector belongs to a different user — service returns None → 404."""
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    app.dependency_overrides[get_db] = lambda: _db_with_connector(connector=None)

    other_oid = ObjectId()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            f"/api/v1/connectors/{other_oid}",
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 404
