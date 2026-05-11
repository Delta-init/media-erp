"""
Tests for feature 2.6 — Facebook Ads OAuth helpers and URL generation.
HTTP calls to Facebook are mocked; no real credentials required.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.utils.oauth import generate_state, store_state, consume_state


# ── Auth URL ──────────────────────────────────────────────────────────────────

def test_facebook_auth_url_structure():
    from app.platforms.facebook_ads import get_auth_url
    url = get_auth_url(connector_id="conn1", user_id="user1")
    assert url.startswith("https://www.facebook.com/")
    assert "dialog/oauth" in url
    assert "state=" in url
    assert "ads_read" in url
    assert "ads_management" in url
    assert "read_insights" in url
    assert "response_type=code" in url


def test_facebook_auth_url_stores_state():
    from app.platforms.facebook_ads import get_auth_url
    from urllib.parse import urlparse, parse_qs
    url = get_auth_url(connector_id="conn1", user_id="user1")
    qs = parse_qs(urlparse(url).query)
    state = qs["state"][0]
    payload = consume_state(state)
    assert payload["connector_id"] == "conn1"
    assert payload["user_id"] == "user1"
    assert payload["platform"] == "facebook_ads"
    # no code_verifier — Facebook doesn't use PKCE
    assert "code_verifier" not in payload


def test_facebook_auth_url_no_pkce():
    """Facebook flow must NOT include PKCE parameters."""
    from app.platforms.facebook_ads import get_auth_url
    from urllib.parse import urlparse, parse_qs
    url = get_auth_url(connector_id="c1", user_id="u1")
    qs = parse_qs(urlparse(url).query)
    assert "code_challenge" not in qs
    assert "code_challenge_method" not in qs
    # clean up state
    consume_state(qs["state"][0])


# ── exchange_code error cases ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_facebook_exchange_code_invalid_state():
    from app.platforms.facebook_ads import exchange_code
    with pytest.raises(ValueError, match="Invalid or expired OAuth state"):
        await exchange_code(code="any", state="nonexistent-state")


@pytest.mark.asyncio
async def test_facebook_exchange_code_short_token_error():
    from app.platforms.facebook_ads import exchange_code

    state = generate_state()
    store_state(state, connector_id="c1", user_id="u1", platform="facebook_ads")

    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = '{"error": {"message": "Invalid verification code format."}}'

    with patch("app.platforms.facebook_ads.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_client.return_value.get = AsyncMock(return_value=mock_resp)

        with pytest.raises(ValueError, match="Facebook token exchange failed"):
            await exchange_code(code="bad-code", state=state)


@pytest.mark.asyncio
async def test_facebook_exchange_code_long_lived_error():
    """Short-lived exchange succeeds but long-lived exchange fails."""
    from app.platforms.facebook_ads import exchange_code

    state = generate_state()
    store_state(state, connector_id="c1", user_id="u1", platform="facebook_ads")

    short_ok = MagicMock()
    short_ok.status_code = 200
    short_ok.json.return_value = {"access_token": "short-token"}

    long_fail = MagicMock()
    long_fail.status_code = 400
    long_fail.text = '{"error": "invalid_token"}'

    with patch("app.platforms.facebook_ads.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_client.return_value.get = AsyncMock(side_effect=[short_ok, long_fail])

        with pytest.raises(ValueError, match="Facebook long-lived token exchange failed"):
            await exchange_code(code="ok-code", state=state)


# ── exchange_code happy path ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_facebook_exchange_code_happy():
    from app.platforms.facebook_ads import exchange_code

    state = generate_state()
    store_state(state, connector_id="c1", user_id="u1", platform="facebook_ads")

    short_ok = MagicMock()
    short_ok.status_code = 200
    short_ok.json.return_value = {"access_token": "short-token"}

    long_ok = MagicMock()
    long_ok.status_code = 200
    long_ok.json.return_value = {
        "access_token": "EAAlong-lived-token",
        "expires_in": 5183944,  # ~60 days in seconds
    }

    with patch("app.platforms.facebook_ads.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_client.return_value.get = AsyncMock(side_effect=[short_ok, long_ok])

        result = await exchange_code(code="good-code", state=state)

    assert result["connector_id"] == "c1"
    assert result["user_id"] == "u1"
    assert result["access_token"] == "EAAlong-lived-token"
    assert result["refresh_token"] == "EAAlong-lived-token"  # same token stored twice
    assert result["expires_at"] is not None


# ── refresh_access_token ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_facebook_refresh_token_happy():
    from app.platforms.facebook_ads import refresh_access_token

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "access_token": "EAAnew-extended-token",
        "expires_in": 5183944,
    }

    with patch("app.platforms.facebook_ads.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_client.return_value.get = AsyncMock(return_value=mock_resp)

        result = await refresh_access_token("old-long-lived-token")

    assert result["access_token"] == "EAAnew-extended-token"
    assert result["expires_at"] is not None


@pytest.mark.asyncio
async def test_facebook_refresh_token_error():
    from app.platforms.facebook_ads import refresh_access_token

    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = '{"error": "expired_token"}'

    with patch("app.platforms.facebook_ads.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_client.return_value.get = AsyncMock(return_value=mock_resp)

        with pytest.raises(ValueError, match="Facebook token refresh failed"):
            await refresh_access_token("expired-token")


# ── router-level tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_facebook_auth_route_wrong_platform():
    """Requesting Facebook auth URL for a ga4 connector → 400."""
    from httpx import AsyncClient, ASGITransport
    from bson import ObjectId
    from app.main import app
    from app.database import get_db
    from app.middleware.auth import get_current_user

    user_oid = ObjectId()
    connector_oid = ObjectId()
    user = {"_id": user_oid, "email": "t@t.com", "name": "T", "role": "user", "plan": "free", "is_active": True}
    connector = {
        "_id": connector_oid, "user_id": str(user_oid), "platform": "ga4",
        "name": "GA4", "status": "disconnected", "sync_frequency": "daily",
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
                f"/api/v1/connectors/facebook_ads/auth?connector_id={connector_oid}",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 400
        assert resp.json()["success"] is False
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_facebook_auth_route_not_found():
    from httpx import AsyncClient, ASGITransport
    from bson import ObjectId
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
                f"/api/v1/connectors/facebook_ads/auth?connector_id={ObjectId()}",
                headers={"Authorization": "Bearer fake"},
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_facebook_callback_invalid_state():
    """Callback with a state that was never stored → 400."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.database import get_db

    col = MagicMock()
    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=col)
    app.dependency_overrides[get_db] = lambda: db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(
                "/api/v1/connectors/facebook_ads/callback?code=x&state=bad-state",
            )
        assert resp.status_code == 400
        assert "Invalid" in resp.json()["message"]
    finally:
        app.dependency_overrides.clear()
