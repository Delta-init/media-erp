"""
Tests for features 2.3 & 2.4 — OAuth helpers and Google Ads URL generation.
HTTP calls to Google are mocked; no real credentials required.
"""
import hashlib
import base64
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta

from app.utils.oauth import (
    generate_pkce_pair,
    generate_state,
    store_state,
    consume_state,
)


# ── Happy path — PKCE ─────────────────────────────────────────────────────────

def test_pkce_pair_structure():
    verifier, challenge = generate_pkce_pair()
    assert len(verifier) > 0
    assert len(challenge) > 0
    # verifier and challenge must be different
    assert verifier != challenge


def test_pkce_challenge_is_s256_of_verifier():
    verifier, challenge = generate_pkce_pair()
    digest = hashlib.sha256(verifier.encode()).digest()
    expected = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    assert challenge == expected


def test_pkce_pairs_are_unique():
    pairs = [generate_pkce_pair() for _ in range(5)]
    verifiers = [p[0] for p in pairs]
    assert len(set(verifiers)) == 5  # all unique


# ── Happy path — state store ──────────────────────────────────────────────────

def test_state_roundtrip():
    state = generate_state()
    store_state(state, connector_id="abc", user_id="xyz", platform="google_ads")
    payload = consume_state(state)
    assert payload == {"connector_id": "abc", "user_id": "xyz", "platform": "google_ads"}


def test_consume_state_removes_entry():
    state = generate_state()
    store_state(state, connector_id="abc")
    consume_state(state)
    assert consume_state(state) is None  # second consume returns None


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_consume_unknown_state_returns_none():
    assert consume_state("no-such-state-xyz") is None


def test_states_are_unique():
    states = [generate_state() for _ in range(10)]
    assert len(set(states)) == 10


# ── Google Ads auth URL ───────────────────────────────────────────────────────

def test_google_ads_auth_url_structure():
    from app.platforms.google_ads import get_auth_url
    url = get_auth_url(connector_id="conn123", user_id="user456")
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth")
    assert "code_challenge_method=S256" in url
    assert "access_type=offline" in url
    assert "prompt=consent" in url
    assert "state=" in url


def test_google_ads_auth_url_stores_state():
    from app.platforms.google_ads import get_auth_url
    from urllib.parse import urlparse, parse_qs
    url = get_auth_url(connector_id="conn123", user_id="user456")
    qs = parse_qs(urlparse(url).query)
    state = qs["state"][0]
    payload = consume_state(state)
    assert payload["connector_id"] == "conn123"
    assert payload["user_id"] == "user456"
    assert payload["platform"] == "google_ads"
    assert "code_verifier" in payload


# ── Error cases — exchange_code ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_exchange_code_invalid_state():
    from app.platforms.google_ads import exchange_code
    with pytest.raises(ValueError, match="Invalid or expired OAuth state"):
        await exchange_code(code="any", state="nonexistent-state")


@pytest.mark.asyncio
async def test_exchange_code_google_error():
    from app.platforms.google_ads import exchange_code
    from app.utils.oauth import generate_state, store_state

    state = generate_state()
    store_state(state, connector_id="c1", user_id="u1", code_verifier="v1", platform="google_ads")

    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = '{"error": "invalid_grant"}'

    with patch("app.platforms.google_ads.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_client.return_value.post = AsyncMock(return_value=mock_resp)

        with pytest.raises(ValueError, match="Google token exchange failed"):
            await exchange_code(code="bad-code", state=state)


# ── Permission — token not exposed in connector output ────────────────────────

def test_connector_to_out_hides_tokens():
    from app.schemas.connector import connector_to_out
    from bson import ObjectId
    from datetime import datetime

    doc = {
        "_id": ObjectId(),
        "user_id": "u1",
        "platform": "google_ads",
        "name": "Test",
        "status": "connected",
        "sync_frequency": "daily",
        "encrypted_access_token": "secret-encrypted-value",
        "encrypted_refresh_token": "secret-refresh-value",
        "token_expires_at": datetime(2026, 5, 5),
        "last_synced_at": None,
        "error_message": None,
        "platform_account_id": "123-456",
        "created_at": datetime(2026, 5, 5),
        "updated_at": datetime(2026, 5, 5),
    }
    out = connector_to_out(doc)
    assert "encrypted_access_token" not in out
    assert "encrypted_refresh_token" not in out
    assert out["status"] == "connected"
    assert out["platform_account_id"] == "123-456"
