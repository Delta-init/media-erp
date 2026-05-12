"""
Facebook Pages OAuth2 + Pages API + Messenger DMs.
Scopes: pages_show_list, pages_manage_posts, pages_messaging, pages_read_engagement
Token flow identical to facebook_ads: short-lived → long-lived (60 days).
"""
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.utils.oauth import generate_state, store_state, consume_state

_GRAPH_VERSION = "v21.0"
_AUTH_URL = f"https://www.facebook.com/{_GRAPH_VERSION}/dialog/oauth"
_TOKEN_URL = f"https://graph.facebook.com/{_GRAPH_VERSION}/oauth/access_token"
_SCOPES = "pages_show_list,pages_manage_posts,pages_read_engagement,pages_messaging"
_LONG_LIVED_EXPIRE_DAYS = 60


def get_auth_url(connector_id: str, user_id: str) -> str:
    state = generate_state()
    store_state(state, connector_id=connector_id, user_id=user_id, platform="facebook_pages")
    params = {
        "client_id": settings.facebook_app_id,
        "redirect_uri": settings.facebook_pages_redirect_uri,
        "scope": _SCOPES,
        "state": state,
        "response_type": "code",
    }
    return f"{_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str, state: str) -> dict:
    state_data = consume_state(state)
    if not state_data:
        raise ValueError("Invalid or expired OAuth state")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _TOKEN_URL,
            params={
                "client_id": settings.facebook_app_id,
                "client_secret": settings.facebook_app_secret,
                "redirect_uri": settings.facebook_pages_redirect_uri,
                "code": code,
            },
        )
        resp.raise_for_status()
        short_token = resp.json()["access_token"]

        resp2 = await client.get(
            _TOKEN_URL,
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.facebook_app_id,
                "client_secret": settings.facebook_app_secret,
                "fb_exchange_token": short_token,
            },
        )
        resp2.raise_for_status()
        long_token = resp2.json()["access_token"]

    expires_at = datetime.now(timezone.utc) + timedelta(days=_LONG_LIVED_EXPIRE_DAYS)
    return {
        "connector_id": state_data["connector_id"],
        "user_id": state_data["user_id"],
        "access_token": long_token,
        "refresh_token": long_token,
        "expires_at": expires_at,
    }


async def get_pages(access_token: str) -> list[dict]:
    """Return pages the user manages, each with its own page-scoped token."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.facebook.com/{_GRAPH_VERSION}/me/accounts",
            params={
                "access_token": access_token,
                "fields": "id,name,access_token,picture{url}",
            },
        )
        resp.raise_for_status()
        return resp.json().get("data", [])


async def publish_post(
    page_id: str,
    page_token: str,
    message: str,
    link: str | None = None,
    image_url: str | None = None,
) -> dict:
    """Publish a post to a Facebook Page. Returns {id: post_id}."""
    async with httpx.AsyncClient() as client:
        if image_url:
            resp = await client.post(
                f"https://graph.facebook.com/{_GRAPH_VERSION}/{page_id}/photos",
                params={"access_token": page_token, "url": image_url, "caption": message},
            )
        else:
            params: dict = {"access_token": page_token, "message": message}
            if link:
                params["link"] = link
            resp = await client.post(
                f"https://graph.facebook.com/{_GRAPH_VERSION}/{page_id}/feed",
                params=params,
            )
        resp.raise_for_status()
        return resp.json()


async def send_dm(
    page_id: str,
    page_token: str,
    recipient_id: str,
    message: str,
) -> dict:
    """
    Send a Messenger DM from a Facebook Page.
    Recipient must have messaged your page within the last 24 hours (Meta policy).
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.facebook.com/{_GRAPH_VERSION}/{page_id}/messages",
            params={"access_token": page_token},
            json={
                "recipient": {"id": recipient_id},
                "message": {"text": message},
                "messaging_type": "RESPONSE",
            },
        )
        resp.raise_for_status()
        return resp.json()
