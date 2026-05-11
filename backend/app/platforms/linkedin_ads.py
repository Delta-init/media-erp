"""
LinkedIn Ads OAuth2 + token management — Phase 3.8.

Scopes required (Marketing Developer Platform product):
  r_ads           — read ad account structure
  r_ads_reporting — read campaign analytics

Flow
----
  Standard Authorization Code grant (no PKCE — LinkedIn doesn't support it).
  State nonce provides CSRF protection.

Token lifetimes
---------------
  access_token          : ~60 days  (expires_in ≈ 5 183 944 s)
  refresh_token         : ~1 year   (refresh_token_expires_in ≈ 31 536 000 s)
  Refresh uses grant_type=refresh_token (standard RFC 6749).
"""

from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.utils.oauth import generate_state, store_state, consume_state

_AUTH_URL  = "https://www.linkedin.com/oauth/v2/authorization"
_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"

# NOTE: r_ads + r_ads_reporting require the LinkedIn Marketing Developer Platform
# product to be added to your app at https://www.linkedin.com/developers/apps.
# Without MDP approval, LinkedIn returns invalid_scope_error and the callback
# redirects back to the frontend with oauth_error= instead of crashing.
_SCOPES    = "r_ads r_ads_reporting"


def get_auth_url(connector_id: str, user_id: str) -> str:
    """Build the LinkedIn OAuth consent URL and persist the state nonce."""
    state = generate_state()
    store_state(state, connector_id=connector_id, user_id=user_id, platform="linkedin_ads")
    params = {
        "response_type": "code",
        "client_id":     settings.linkedin_client_id,
        "redirect_uri":  settings.linkedin_redirect_uri,
        "state":         state,
        "scope":         _SCOPES,
    }
    return f"{_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str, state: str) -> dict:
    """
    Exchange the authorization code for access + refresh tokens.

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
                "grant_type":    "authorization_code",
                "code":          code,
                "redirect_uri":  settings.linkedin_redirect_uri,
                "client_id":     settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if resp.status_code != 200:
        raise ValueError(f"LinkedIn token exchange failed: {resp.text}")

    data = resp.json()
    expires_in = data.get("expires_in", 5_183_944)   # ~60 days
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    return {
        "connector_id":  state_data["connector_id"],
        "user_id":       state_data["user_id"],
        "access_token":  data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_at":    expires_at,
    }


async def refresh_access_token(refresh_token: str) -> dict:
    """
    Obtain a new access token using the stored refresh token.
    Caller must decrypt the refresh token first.

    Returns:
        {access_token, expires_at}
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _TOKEN_URL,
            data={
                "grant_type":    "refresh_token",
                "refresh_token": refresh_token,
                "client_id":     settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if resp.status_code != 200:
        raise ValueError(f"LinkedIn token refresh failed: {resp.text}")

    data = resp.json()
    expires_in = data.get("expires_in", 5_183_944)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    return {"access_token": data["access_token"], "expires_at": expires_at}
