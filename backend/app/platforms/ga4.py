"""
GA4 OAuth2 + token management.
Scopes: https://www.googleapis.com/auth/analytics.readonly
Shares the same Google OAuth2 client credentials as Google Ads.
Uses PKCE (S256).
"""
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.utils.oauth import generate_pkce_pair, generate_state, store_state, consume_state

_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_SCOPES = "https://www.googleapis.com/auth/analytics.readonly"


def get_auth_url(connector_id: str, user_id: str) -> str:
    verifier, challenge = generate_pkce_pair()
    state = generate_state()
    store_state(
        state,
        connector_id=connector_id,
        user_id=user_id,
        code_verifier=verifier,
        platform="ga4",
    )
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.ga4_redirect_uri,
        "response_type": "code",
        "scope": _SCOPES,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str, state: str) -> dict:
    """
    Exchange the authorization code for tokens.

    Returns:
        {connector_id, user_id, access_token, refresh_token, expires_at}

    Raises:
        ValueError on invalid/expired state or failed token exchange.
    """
    state_data = consume_state(state)
    if not state_data:
        raise ValueError("Invalid or expired OAuth state")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.ga4_redirect_uri,
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": state_data["code_verifier"],
            },
        )

    if resp.status_code != 200:
        raise ValueError(f"GA4 token exchange failed: {resp.text}")

    tokens = resp.json()
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=tokens.get("expires_in", 3600)
    )
    return {
        "connector_id": state_data["connector_id"],
        "user_id": state_data["user_id"],
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token"),
        "expires_at": expires_at,
    }


async def refresh_access_token(refresh_token: str) -> dict:
    """
    Obtain a new access token using the stored refresh token.
    Caller must decrypt the refresh token first via get_decrypted_tokens().

    Returns:
        {access_token, expires_at}
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )

    if resp.status_code != 200:
        raise ValueError(f"GA4 token refresh failed: {resp.text}")

    tokens = resp.json()
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=tokens.get("expires_in", 3600)
    )
    return {"access_token": tokens["access_token"], "expires_at": expires_at}
