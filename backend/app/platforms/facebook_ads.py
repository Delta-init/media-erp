"""
Facebook Ads OAuth2 + token management.
Scopes: ads_read, ads_management, read_insights

Facebook does not support PKCE — the state nonce provides CSRF protection.
Token exchange is two-step:
  1. code → short-lived user token (1-2 h)
  2. short-lived token → long-lived token (60 days) via fb_exchange_token grant
The long-lived token is stored as both access_token and refresh_token; re-extension
reuses it via the same fb_exchange_token endpoint.
"""
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.utils.oauth import generate_state, store_state, consume_state

_GRAPH_VERSION = "v21.0"
_AUTH_URL = f"https://www.facebook.com/{_GRAPH_VERSION}/dialog/oauth"
_TOKEN_URL = f"https://graph.facebook.com/{_GRAPH_VERSION}/oauth/access_token"
_SCOPES = "ads_read,ads_management,read_insights"
_LONG_LIVED_EXPIRE_DAYS = 60


def get_auth_url(connector_id: str, user_id: str) -> str:
    state = generate_state()
    store_state(state, connector_id=connector_id, user_id=user_id, platform="facebook_ads")
    params = {
        "client_id": settings.facebook_app_id,
        "redirect_uri": settings.facebook_redirect_uri,
        "scope": _SCOPES,
        "state": state,
        "response_type": "code",
    }
    return f"{_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str, state: str) -> dict:
    """
    Exchange auth code → short-lived token → long-lived token.

    Returns:
        {connector_id, user_id, access_token, refresh_token, expires_at}

    Raises:
        ValueError on invalid/expired state or any failed exchange.
    """
    state_data = consume_state(state)
    if not state_data:
        raise ValueError("Invalid or expired OAuth state")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _TOKEN_URL,
            params={
                "client_id": settings.facebook_app_id,
                "client_secret": settings.facebook_app_secret,
                "redirect_uri": settings.facebook_redirect_uri,
                "code": code,
            },
        )

    if resp.status_code != 200:
        raise ValueError(f"Facebook token exchange failed: {resp.text}")

    short_token = resp.json()["access_token"]

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _TOKEN_URL,
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.facebook_app_id,
                "client_secret": settings.facebook_app_secret,
                "fb_exchange_token": short_token,
            },
        )

    if resp.status_code != 200:
        raise ValueError(f"Facebook long-lived token exchange failed: {resp.text}")

    data = resp.json()
    expires_in = data.get("expires_in", _LONG_LIVED_EXPIRE_DAYS * 86400)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    long_token = data["access_token"]

    return {
        "connector_id": state_data["connector_id"],
        "user_id": state_data["user_id"],
        "access_token": long_token,
        "refresh_token": long_token,  # same token used to re-extend
        "expires_at": expires_at,
    }


async def refresh_access_token(long_lived_token: str) -> dict:
    """
    Extend a Facebook long-lived token before it expires.
    Caller must decrypt the token first via get_decrypted_tokens().

    Returns:
        {access_token, expires_at}
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _TOKEN_URL,
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.facebook_app_id,
                "client_secret": settings.facebook_app_secret,
                "fb_exchange_token": long_lived_token,
            },
        )

    if resp.status_code != 200:
        raise ValueError(f"Facebook token refresh failed: {resp.text}")

    data = resp.json()
    expires_in = data.get("expires_in", _LONG_LIVED_EXPIRE_DAYS * 86400)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    return {"access_token": data["access_token"], "expires_at": expires_at}
