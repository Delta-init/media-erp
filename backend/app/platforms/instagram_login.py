"""
Instagram Login — OAuth2 direct Instagram login (no Facebook Page required).
Meta's replacement for the deprecated Basic Display API (shut down Dec 2024).

Scopes: instagram_business_basic, instagram_business_content_publish,
        instagram_business_manage_messages

Works with Business AND Creator accounts. No Facebook Page linking required.

Auth URL:    https://www.instagram.com/oauth/authorize
Token URL:   https://api.instagram.com/oauth/access_token  (short-lived, POST form)
Long-lived:  https://graph.instagram.com/access_token  (GET, ~60 days)
Refresh:     https://graph.instagram.com/refresh_access_token  (GET)
API base:    https://graph.instagram.com/v21.0/
"""
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.utils.oauth import generate_state, store_state, consume_state

_GRAPH_VERSION = "v21.0"
_AUTH_URL = "https://www.instagram.com/oauth/authorize"
_SHORT_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
_LONG_TOKEN_URL = "https://graph.instagram.com/access_token"
_REFRESH_URL = "https://graph.instagram.com/refresh_access_token"
_API_BASE = f"https://graph.instagram.com/{_GRAPH_VERSION}"
_SCOPES = "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages"
_LONG_LIVED_EXPIRE_DAYS = 60


def get_auth_url(connector_id: str, user_id: str) -> str:
    state = generate_state()
    store_state(state, connector_id=connector_id, user_id=user_id, platform="instagram_login")
    params = {
        "client_id": settings.instagram_app_id,
        "redirect_uri": settings.instagram_login_redirect_uri,
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
        # Step 1: Short-lived token (POST, form-encoded — NOT JSON)
        resp = await client.post(
            _SHORT_TOKEN_URL,
            data={
                "client_id": settings.instagram_app_id,
                "client_secret": settings.instagram_app_secret,
                "grant_type": "authorization_code",
                "redirect_uri": settings.instagram_login_redirect_uri,
                "code": code,
            },
        )
        resp.raise_for_status()
        short_data = resp.json()
        short_token = short_data["access_token"]

        # Step 2: Exchange short-lived → long-lived (GET)
        resp2 = await client.get(
            _LONG_TOKEN_URL,
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": settings.instagram_app_secret,
                "access_token": short_token,
            },
        )
        resp2.raise_for_status()
        long_data = resp2.json()
        long_token = long_data["access_token"]
        expires_in = long_data.get("expires_in", _LONG_LIVED_EXPIRE_DAYS * 86400)

        # Step 3: Fetch IG user ID to store as platform_account_id
        resp3 = await client.get(
            f"{_API_BASE}/me",
            params={
                "access_token": long_token,
                "fields": "id,name,username",
            },
        )
        resp3.raise_for_status()
        user_info = resp3.json()

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    return {
        "connector_id": state_data["connector_id"],
        "user_id": state_data["user_id"],
        "access_token": long_token,
        "refresh_token": long_token,
        "expires_at": expires_at,
        "ig_user_id": user_info["id"],
        "ig_username": user_info.get("username", ""),
    }


async def get_user_info(access_token: str) -> dict:
    """Return basic profile info for the connected Instagram account."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_API_BASE}/me",
            params={
                "access_token": access_token,
                "fields": "id,name,username,profile_picture_url,followers_count,media_count",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def publish_post(
    ig_user_id: str,
    access_token: str,
    caption: str,
    image_url: str | None = None,
    video_url: str | None = None,
) -> dict:
    """
    Publish to Instagram via Instagram Login.
    Two-step: create media container → publish.
    image_url or video_url must be a publicly accessible URL.
    Returns {id: media_id}.
    """
    if not image_url and not video_url:
        raise ValueError("image_url or video_url is required for Instagram posts")

    async with httpx.AsyncClient(timeout=30.0) as client:
        params: dict = {"access_token": access_token, "caption": caption}
        if video_url:
            params["media_type"] = "REELS"
            params["video_url"] = video_url
        else:
            params["image_url"] = image_url

        resp = await client.post(
            f"{_API_BASE}/{ig_user_id}/media",
            params=params,
        )
        resp.raise_for_status()
        creation_id = resp.json()["id"]

        resp2 = await client.post(
            f"{_API_BASE}/{ig_user_id}/media_publish",
            params={"access_token": access_token, "creation_id": creation_id},
        )
        resp2.raise_for_status()
        return resp2.json()


async def get_conversations(ig_user_id: str, access_token: str) -> list[dict]:
    """List Instagram Direct conversations for the connected account."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_API_BASE}/{ig_user_id}/conversations",
            params={
                "access_token": access_token,
                "fields": "id,participants,snippet,updated_time,unread_count",
                "platform": "instagram",
            },
        )
        resp.raise_for_status()
        return resp.json().get("data", [])


async def get_conversation_messages(conversation_id: str, access_token: str) -> list[dict]:
    """Get messages inside an Instagram Direct conversation."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_API_BASE}/{conversation_id}/messages",
            params={
                "access_token": access_token,
                "fields": "id,message,from,created_time",
            },
        )
        resp.raise_for_status()
        # API returns newest first — reverse so oldest is at top
        return list(reversed(resp.json().get("data", [])))


async def send_dm(
    ig_user_id: str,
    access_token: str,
    recipient_id: str,
    message: str,
) -> dict:
    """
    Send an Instagram DM via Instagram Login.
    Recipient must have messaged your account first (Meta policy).
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_API_BASE}/{ig_user_id}/messages",
            params={"access_token": access_token},
            json={
                "recipient": {"id": recipient_id},
                "message": {"text": message},
            },
        )
        resp.raise_for_status()
        return resp.json()
