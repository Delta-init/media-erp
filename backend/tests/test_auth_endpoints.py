"""
4-case test suite for feature 1.9 — POST /auth/register & POST /auth/login.
DB mocked via dependency_overrides (see mistakes.md — never use patch() on Depends targets).
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from httpx import AsyncClient, ASGITransport
from passlib.context import CryptContext

from app.main import app
from app.database import get_db

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
HASHED_PW = _pwd.hash("password123")   # pre-computed once for speed

USER_OID = ObjectId()
EXISTING_USER = {
    "_id": USER_OID,
    "email": "existing@test.com",
    "hashed_password": HASHED_PW,
    "name": "Existing",
    "role": "user",
    "plan": "free",
    "is_active": True,
}


# ── DB mock helpers ───────────────────────────────────────────────────────────

def _col(*, find_result, insert_id=None):
    col = MagicMock()
    col.find_one = AsyncMock(return_value=find_result)
    ins = MagicMock()
    ins.inserted_id = insert_id or ObjectId()
    col.insert_one = AsyncMock(return_value=ins)
    return col


def _db(col):
    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=col)
    return db


def _override(col):
    def _dep():
        return _db(col)
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

async def test_register_success(client):
    # find_one returns None (email not taken), insert_one succeeds
    app.dependency_overrides[get_db] = _override(_col(find_result=None))
    r = await client.post("/api/v1/auth/register", json={
        "email": "new@test.com", "password": "password123", "name": "New User",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["success"] is True
    assert body["message"] == "Registration successful"
    data = body["data"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "new@test.com"


async def test_login_success(client):
    app.dependency_overrides[get_db] = _override(_col(find_result=EXISTING_USER))
    r = await client.post("/api/v1/auth/login", json={
        "email": "existing@test.com", "password": "password123",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["message"] == "Login successful"
    assert "access_token" in body["data"]


# ── Case 2 — Edge / Boundary ──────────────────────────────────────────────────

async def test_register_password_too_short_returns_422(client):
    """Pydantic min_length=8 must reject 7-char passwords before DB is touched."""
    app.dependency_overrides[get_db] = _override(_col(find_result=None))
    r = await client.post("/api/v1/auth/register", json={
        "email": "x@test.com", "password": "short", "name": "X",
    })
    assert r.status_code == 422


async def test_register_empty_name_returns_422(client):
    app.dependency_overrides[get_db] = _override(_col(find_result=None))
    r = await client.post("/api/v1/auth/register", json={
        "email": "x@test.com", "password": "password123", "name": "",
    })
    assert r.status_code == 422


# ── Case 3 — Error / Invalid Input ───────────────────────────────────────────

async def test_register_duplicate_email_returns_409(client):
    # find_one returns existing user → conflict
    app.dependency_overrides[get_db] = _override(_col(find_result=EXISTING_USER))
    r = await client.post("/api/v1/auth/register", json={
        "email": "existing@test.com", "password": "password123", "name": "Dup",
    })
    assert r.status_code == 409
    assert r.json()["success"] is False


async def test_login_wrong_password_returns_401(client):
    app.dependency_overrides[get_db] = _override(_col(find_result=EXISTING_USER))
    r = await client.post("/api/v1/auth/login", json={
        "email": "existing@test.com", "password": "wrongpassword",
    })
    assert r.status_code == 401
    assert r.json()["success"] is False


async def test_login_unknown_email_returns_401(client):
    app.dependency_overrides[get_db] = _override(_col(find_result=None))
    r = await client.post("/api/v1/auth/login", json={
        "email": "nobody@test.com", "password": "password123",
    })
    assert r.status_code == 401


async def test_register_invalid_email_returns_422(client):
    app.dependency_overrides[get_db] = _override(_col(find_result=None))
    r = await client.post("/api/v1/auth/register", json={
        "email": "not-an-email", "password": "password123", "name": "X",
    })
    assert r.status_code == 422


# ── Case 4 — Permission / Auth ────────────────────────────────────────────────

async def test_login_inactive_account_returns_401(client):
    inactive = {**EXISTING_USER, "is_active": False}
    app.dependency_overrides[get_db] = _override(_col(find_result=inactive))
    r = await client.post("/api/v1/auth/login", json={
        "email": "existing@test.com", "password": "password123",
    })
    assert r.status_code == 401


async def test_login_response_matches_success_contract(client):
    """Response body must have {success, message, data} — success_response() contract."""
    app.dependency_overrides[get_db] = _override(_col(find_result=EXISTING_USER))
    r = await client.post("/api/v1/auth/login", json={
        "email": "existing@test.com", "password": "password123",
    })
    body = r.json()
    assert set(body.keys()) == {"success", "message", "data"}
    assert isinstance(body["success"], bool) and body["success"]
