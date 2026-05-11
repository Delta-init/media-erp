"""
TikTok Ads OAuth2 + token management — Phase 3.9.

Scopes required (enable in TikTok for Business developer portal):
  advertiser.read   — read advertiser account info
  report.read       — read campaign analytics

Flow
----
  Standard Authorization Code grant with state-nonce CSRF.
  TikTok's callback parameter is named `auth_code` (not `code`).
  The token exchange uses a JSON body (not form-encoded).

Token lifetime
--------------
  TikTok Marketing API access tokens are long-lived (~permanent for
  approved apps; sandbox tokens do not expire).
  There is no refresh token — re-authentication generates a new token.
"""

from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.utils.oauth import generate_state, store_state, consume_state

_AUTH_URL  = "https://business-api.tiktok.com/portal/auth"
_TOKEN_URL = "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/"

# Tokens are long-lived; we set a 365-day nominal expiry so the sync
# service's "refresh within 5 min" logic never triggers.
_TOKEN_TTL_DAYS = 365


def get_auth_url(connector_id: str, user_id: str) -> str:
    """Build the TikTok Business OAuth consent URL and persist the state nonce."""
    state = generate_state()
    store_state(state, connector_id=connector_id, user_id=user_id, platform="tiktok_ads")
    params = {
        "app_id":       settings.tiktok_app_id,
        "state":        state,
        "redirect_uri": settings.tiktok_redirect_uri,
    }
    return f"{_AUTH_URL}?{urlencode(params)}"


async def exchange_code(auth_code: str, state: str) -> dict:
    """
    Exchange the TikTok auth_code for an access token.

    TikTok's token endpoint expects a JSON body and returns advertiser_ids
    directly — we store the first one as platform_account_id.

    Returns:
        {connector_id, user_id, access_token, refresh_token, expires_at,
         advertiser_id}

    Raises:
        ValueError on invalid/expired state or failed exchange.
    """
    state_data = consume_state(state)
    if not state_data:
        raise ValueError("Invalid or expired OAuth state")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _TOKEN_URL,
            json={
                "app_id":    settings.tiktok_app_id,
                "auth_code": auth_code,
                "secret":    settings.tiktok_app_secret,
            },
        )

    if resp.status_code != 200:
        raise ValueError(f"TikTok token exchange HTTP error: {resp.text}")

    body = resp.json()
    if body.get("code") != 0:
        raise ValueError(f"TikTok token exchange failed: {body.get('message', body)}")

    data          = body["data"]
    access_token  = data["access_token"]
    advertiser_ids = data.get("advertiser_ids", [])
    advertiser_id  = str(advertiser_ids[0]) if advertiser_ids else None

    expires_at = datetime.now(timezone.utc) + timedelta(days=_TOKEN_TTL_DAYS)

    return {
        "connector_id":   state_data["connector_id"],
        "user_id":        state_data["user_id"],
        "access_token":   access_token,
        "refresh_token":  None,    # TikTok has no refresh token
        "expires_at":     expires_at,
        "advertiser_id":  advertiser_id,
    }
