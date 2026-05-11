"""
Tests for feature 2.5 — GA4 OAuth helpers and URL generation.
HTTP calls to Google are mocked; no real credentials required.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.utils.oauth import generate_state, store_state, consume_state


# ── GA4 auth URL ──────────────────────────────────────────────────────────────

def test_ga4_auth_url_structure():
    from app.platforms.ga4 import get_auth_url
    url = get_auth_url(connector_id="conn1", user_id="user1")
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth")
    assert "code_challenge_method=S256" in url
    assert "access_type=offline" in url
    assert "prompt=consent" in url
    assert "state=" in url
    assert "analytics.readonly" in url


def test_ga4_auth_url_stores_state():
    from app.platforms.ga4 import get_auth_url
    from urllib.parse import urlparse, parse_qs
    url = get_auth_url(connector_id="conn1", user_id="user1")
    qs = parse_qs(urlparse(url).query)
    state = qs["state"][0]
    payload = consume_state(state)
    assert payload["connector_id"] == "conn1"
    assert payload["user_id"] == "user1"
    assert payload["platform"] == "ga4"
    assert "code_verifier" in payload


def test_ga4_auth_url_differs_from_google_ads():
    """GA4 and Google Ads must use different redirect URIs and scopes."""
    from app.platforms.ga4 import get_auth_url as ga4_url
    from app.platforms.google_ads import get_auth_url as gads_url
    url_ga4 = ga4_url(connector_id="c1", user_id="u1")
    url_gads = gads_url(connector_id="c1", user_id="u1")
    assert "ga4" in url_ga4
    assert "adwords" not in url_ga4
    assert "analytics.readonly" in url_ga4
    # clean up the states both calls stored
    from urllib.parse import urlparse, parse_qs
    for url in (url_ga4, url_gads):
        s = parse_qs(urlparse(url).query)["state"][0]
        consume_state(s)


# ── exchange_code error cases ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ga4_exchange_code_invalid_state():
    from app.platforms.ga4 import exchange_code
    with pytest.raises(ValueError, match="Invalid or expired OAuth state"):
        await exchange_code(code="any", state="nonexistent-state")


@pytest.mark.asyncio
async def test_ga4_exchange_code_google_error():
    from app.platforms.ga4 import exchange_code

    state = generate_state()
    store_state(state, connector_id="c1", user_id="u1", code_verifier="v1", platform="ga4")

    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = '{"error": "invalid_grant"}'

    with patch("app.platforms.ga4.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_client.return_value.post = AsyncMock(return_value=mock_resp)

        with pytest.raises(ValueError, match="GA4 token exchange failed"):
            await exchange_code(code="bad-code", state=state)


# ── exchange_code happy path ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ga4_exchange_code_happy():
    from app.platforms.ga4 import exchange_code

    state = generate_state()
    store_state(state, connector_id="c1", user_id="u1", code_verifier="v1", platform="ga4")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "access_token": "ya29.test",
        "refresh_token": "1//test-refresh",
        "expires_in": 3600,
    }

    with patch("app.platforms.ga4.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_client.return_value.post = AsyncMock(return_value=mock_resp)

        result = await exchange_code(code="good-code", state=state)

    assert result["connector_id"] == "c1"
    assert result["user_id"] == "u1"
    assert result["access_token"] == "ya29.test"
    assert result["refresh_token"] == "1//test-refresh"
    assert result["expires_at"] is not None


# ── router-level tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ga4_auth_route_wrong_platform():
    """Requesting GA4 auth URL for a google_ads connector → 400."""
    from httpx import AsyncClient, ASGITransport
    from bson import ObjectId
    from unittest.mock import MagicMock, AsyncMock
    from app.main import app
    from app.database import get_db
    from app.middleware.auth import get_current_user

    user_oid = ObjectId()
    connector_oid = ObjectId()
    user = {"_id": user_oid, "email": "t@t.com", "name": "T", "role": "user", "plan": "free", "is_active": True}
    connector = {
        "_id": connector_oid, "user_id": str(user_oid), "platform": "google_ads",
        "name": "GA", "status": "disconnected", "sync_frequency": "daily",
        "encrypted_access_token": None, "encrypted_refresh_token": None,
        "token_expires_at": None, "last_synced_at": None, "error_message": None,
        "platform_account_id": None,
        "created_at": __import__("datetime").datetime(2026, 5, 5),
        "updated_at": __import__("datetime").datetime(2026, 5, 5),
    }

    col = MagicMock()
    col.find_one = AsyncMock(return_value=connector)
    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=col)

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(
                f"/api/v1/connectors/ga4/auth?connector_id={connector_oid}",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 400
        assert resp.json()["success"] is False
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_ga4_auth_route_not_found():
    """Connector not found → 404."""
    from httpx import AsyncClient, ASGITransport
    from bson import ObjectId
    from unittest.mock import MagicMock, AsyncMock
    from app.main import app
    from app.database import get_db
    from app.middleware.auth import get_current_user

    user_oid = ObjectId()
    user = {"_id": user_oid, "email": "t@t.com", "name": "T", "role": "user", "plan": "free", "is_active": True}

    col = MagicMock()
    col.find_one = AsyncMock(return_value=None)
    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=col)

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(
                f"/api/v1/connectors/ga4/auth?connector_id={ObjectId()}",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.clear()
