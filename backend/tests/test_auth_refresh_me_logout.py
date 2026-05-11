"""
4-case test suite for feature 1.10 — POST /auth/refresh, GET /auth/me, POST /auth/logout.
DB mocked via dependency_overrides (see mistakes.md — never use patch() on Depends targets).
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from httpx import AsyncClient, ASGITransport
from passlib.context import CryptContext

from app.main import app
from app.database import get_db
from app.middleware.auth import get_current_user
from app.utils.jwt import create_access_token, create_refresh_token

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
HASHED_PW = _pwd.hash("password123")

USER_OID = ObjectId()
ACTIVE_USER = {
    "_id": USER_OID,
    "email": "user@test.com",
    "hashed_password": HASHED_PW,
    "name": "Test User",
    "role": "user",
    "plan": "free",
    "is_active": True,
}

VALID_ACCESS_TOKEN = create_access_token(str(USER_OID))
VALID_REFRESH_TOKEN = create_refresh_token(str(USER_OID))


# ── DB mock helpers ───────────────────────────────────────────────────────────

def _col(*, find_result):
    col = MagicMock()
    col.find_one = AsyncMock(return_value=find_result)
    return col


def _db(col):
    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=col)
    return db


def _db_override(col):
    def _dep():
        return _db(col)
    return _dep


def _user_override(user):
    async def _dep():
        return user
    return _dep


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
async def client():
    with (
        patch("app.database.connect_db",     new_callable=AsyncMock),
        patch("app.database.close_db",       new_callable=AsyncMock),
        patch("app.database.create_indexes", new_callable=AsyncMock),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            yield c
    app.dependency_overrides.clear()


# ── Case 1 — Happy Path ───────────────────────────────────────────────────────

async def test_refresh_success(client):
    app.dependency_overrides[get_db] = _db_override(_col(find_result=ACTIVE_USER))
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": VALID_REFRESH_TOKEN})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["message"] == "Token refreshed"
    data = body["data"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "user@test.com"


async def test_me_success(client):
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    r = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {VALID_ACCESS_TOKEN}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["message"] == "User profile retrieved"
    data = body["data"]
    assert data["email"] == "user@test.com"
    assert data["role"] == "user"
    assert data["plan"] == "free"
    assert "hashed_password" not in data


async def test_logout_success(client):
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    r = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {VALID_ACCESS_TOKEN}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["message"] == "Logged out successfully"


# ── Case 2 — Edge / Boundary ──────────────────────────────────────────────────

async def test_refresh_with_access_token_returns_401(client):
    """Passing an access token where a refresh token is expected must fail."""
    app.dependency_overrides[get_db] = _db_override(_col(find_result=ACTIVE_USER))
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": VALID_ACCESS_TOKEN})
    assert r.status_code == 401
    assert r.json()["success"] is False


async def test_me_response_contract(client):
    """Response must follow {success, message, data} and never leak hashed_password."""
    app.dependency_overrides[get_current_user] = _user_override(ACTIVE_USER)
    r = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {VALID_ACCESS_TOKEN}"},
    )
    body = r.json()
    assert set(body.keys()) == {"success", "message", "data"}
    assert "hashed_password" not in body["data"]
    assert set(body["data"].keys()) == {"id", "email", "name", "role", "plan"}


# ── Case 3 — Error / Invalid Input ───────────────────────────────────────────

async def test_refresh_invalid_token_returns_401(client):
    app.dependency_overrides[get_db] = _db_override(_col(find_result=ACTIVE_USER))
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": "not.a.token"})
    assert r.status_code == 401
    assert r.json()["success"] is False


async def test_me_no_auth_header_returns_403(client):
    """Missing Authorization header → HTTPBearer raises 403."""
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 403


async def test_logout_no_auth_header_returns_403(client):
    r = await client.post("/api/v1/auth/logout")
    assert r.status_code == 403


# ── Case 4 — Permission / Auth ────────────────────────────────────────────────

async def test_refresh_inactive_user_returns_401(client):
    inactive = {**ACTIVE_USER, "is_active": False}
    app.dependency_overrides[get_db] = _db_override(_col(find_result=inactive))
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": VALID_REFRESH_TOKEN})
    assert r.status_code == 401
    assert r.json()["success"] is False


async def test_refresh_user_not_found_returns_401(client):
    app.dependency_overrides[get_db] = _db_override(_col(find_result=None))
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": VALID_REFRESH_TOKEN})
    assert r.status_code == 401
    assert r.json()["success"] is False
