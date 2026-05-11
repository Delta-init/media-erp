"""
4-case test suite for feature 1.8 — auth middleware.
Uses FastAPI dependency_overrides (correct way to mock Depends() targets).
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI, Depends

from app.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.permissions import require_plan
from app.utils.jwt import create_access_token

# ── Minimal test app ──────────────────────────────────────────────────────────

_app = FastAPI()

@_app.get("/protected")
async def _protected(user: dict = Depends(get_current_user)):
    return {"email": user["email"]}

@_app.get("/pro-only")
async def _pro_only(user: dict = Depends(require_plan("pro"))):
    return {"plan": user["plan"]}


# ── Helpers ───────────────────────────────────────────────────────────────────

USER_OID = ObjectId()

def _make_user(plan: str = "free", is_active: bool = True) -> dict:
    return {"_id": USER_OID, "email": "t@test.com", "plan": plan, "is_active": is_active}


def _db_override(user_doc):
    """Returns a FastAPI dependency override that yields a mock DB."""
    col = MagicMock()
    col.find_one = AsyncMock(return_value=user_doc)
    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=col)

    def override():
        return db

    return override


@pytest.fixture
async def client():
    with (
        patch("app.database.connect_db",    new_callable=AsyncMock),
        patch("app.database.close_db",      new_callable=AsyncMock),
        patch("app.database.create_indexes", new_callable=AsyncMock),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=_app), base_url="http://test"
        ) as c:
            yield c
        _app.dependency_overrides.clear()


# ── Case 1 — Happy Path ───────────────────────────────────────────────────────

async def test_valid_token_returns_user(client):
    _app.dependency_overrides[get_db] = _db_override(_make_user())
    token = create_access_token(str(USER_OID))
    r = await client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "t@test.com"


# ── Case 2 — Edge / Boundary ──────────────────────────────────────────────────

async def test_inactive_user_returns_401(client):
    _app.dependency_overrides[get_db] = _db_override(_make_user(is_active=False))
    token = create_access_token(str(USER_OID))
    r = await client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


async def test_user_not_in_db_returns_401(client):
    _app.dependency_overrides[get_db] = _db_override(None)
    token = create_access_token(str(USER_OID))
    r = await client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


# ── Case 3 — Error / Invalid Input ───────────────────────────────────────────

async def test_no_auth_header_returns_403(client):
    """HTTPBearer returns 403 when Authorization header is absent."""
    r = await client.get("/protected")
    assert r.status_code == 403


async def test_bad_token_returns_401(client):
    _app.dependency_overrides[get_db] = _db_override(_make_user())
    r = await client.get("/protected", headers={"Authorization": "Bearer not.a.real.token"})
    assert r.status_code == 401


# ── Case 4 — Permission / Auth ────────────────────────────────────────────────

async def test_free_user_blocked_from_pro_endpoint(client):
    _app.dependency_overrides[get_db] = _db_override(_make_user(plan="free"))
    token = create_access_token(str(USER_OID))
    r = await client.get("/pro-only", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert "pro" in r.json()["detail"]


async def test_pro_user_allowed_on_pro_endpoint(client):
    _app.dependency_overrides[get_db] = _db_override(_make_user(plan="pro"))
    token = create_access_token(str(USER_OID))
    r = await client.get("/pro-only", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["plan"] == "pro"
